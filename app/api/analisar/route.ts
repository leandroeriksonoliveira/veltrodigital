import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isDbConfigured } from '@/lib/conformidade/db';
import {
  insertClientReport,
  insertInternalReport,
  insertLead,
} from '@/lib/conformidade/repository';
import { runComplianceAnalysis } from '@/lib/conformidade/llm';
import { fetchSiteEvidence } from '@/lib/conformidade/site-audit';
import {
  fetchSocialProfileEvidence,
  isInstagramUrl,
  isSocialUrl,
} from '@/lib/conformidade/social-audit';
import { notifyCommercial } from '@/lib/conformidade/notify';
import { PROFESSION_LABELS, type InputType, type Profession } from '@/lib/conformidade/types';

export const runtime = 'nodejs';
export const maxDuration = 90;

const BodySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().optional().or(z.literal('')),
    phone: z.string().trim().max(40).optional().default(''),
    profession: z.enum([
      'medico',
      'advogado',
      'fisioterapeuta',
      'psicologo',
      'dentista',
      'veterinario',
      'enfermeiro',
      'nutricionista',
      'arquiteto',
      'outro',
    ]),
    profile_url: z.string().max(500).optional().default(''),
    site_url: z.string().max(500).optional().default(''),
    consent: z.literal(true),
  })
  .refine((body) => Boolean(body.email || body.phone), {
    message: 'Informe ao menos um contato: WhatsApp ou e-mail.',
    path: ['phone'],
  });

function normalizeUrl(url: string): string {
  const t = url.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const body = BodySchema.parse(json);

    if (!isDbConfigured()) {
      return NextResponse.json(
        {
          error:
            'Banco não configurado. Conecte o Postgres Neon na Vercel (Storage) e defina DATABASE_URL.',
        },
        { status: 503 }
      );
    }

    let socialUrl = normalizeUrl(body.profile_url || '');
    let siteUrl = normalizeUrl(body.site_url || '');

    // Se o usuário colou o Instagram no campo do site (ou vice-versa), corrige
    if (!socialUrl && siteUrl && isSocialUrl(siteUrl)) {
      socialUrl = siteUrl;
      siteUrl = '';
    }
    if (socialUrl && siteUrl && isSocialUrl(siteUrl) && !isSocialUrl(socialUrl)) {
      const tmp = socialUrl;
      socialUrl = siteUrl;
      siteUrl = tmp;
    }
    if (siteUrl && isInstagramUrl(siteUrl) && !socialUrl) {
      socialUrl = siteUrl;
      siteUrl = '';
    }

    if (!socialUrl && !siteUrl) {
      return NextResponse.json(
        { error: 'Informe o link da rede social e/ou do site.' },
        { status: 400 }
      );
    }

    const contentParts: string[] = [];
    const summaryParts: string[] = [];
    let primaryUrl = socialUrl || siteUrl;

    // Coleta rede + site em paralelo quando ambos existem
    const tasks: Promise<void>[] = [];

    if (socialUrl) {
      tasks.push(
        (async () => {
          const evidence = await fetchSocialProfileEvidence(socialUrl);
          primaryUrl = evidence.finalUrl;
          summaryParts.push(`=== REDE SOCIAL ===\n${evidence.summary}`);
          contentParts.push(`--- Conteúdo público da rede social ---\n${evidence.textSample}`);
        })()
      );
    }

    if (siteUrl && !isSocialUrl(siteUrl)) {
      tasks.push(
        (async () => {
          const evidence = await fetchSiteEvidence(siteUrl);
          if (!socialUrl) primaryUrl = evidence.finalUrl;
          summaryParts.push(`=== SITE INSTITUCIONAL ===\n${evidence.summary}`);
          contentParts.push(`--- Conteúdo extraído do site ---\n${evidence.textSample}`);
        })()
      );
    }

    await Promise.all(tasks);

    const contentText = contentParts.join('\n\n').trim();
    const siteSummary = summaryParts.join('\n\n');

    if (!contentText || contentText.length < 20) {
      return NextResponse.json(
        {
          error:
            'Não foi possível coletar conteúdo público dos links. Verifique as URLs e tente novamente.',
        },
        { status: 400 }
      );
    }

    let inputType: InputType = 'misto';
    if (socialUrl && siteUrl && !isSocialUrl(siteUrl)) inputType = 'misto';
    else if (socialUrl) inputType = 'link_referencia';
    else inputType = 'site';

    const professionLabel = PROFESSION_LABELS[body.profession as Profession];
    const analysis = await runComplianceAnalysis({
      name: body.name,
      profession: body.profession,
      professionLabel,
      inputType,
      profileUrl: [socialUrl, siteUrl].filter(Boolean).join(' | '),
      contentText,
      siteSummary,
    });

    const lead = await insertLead({
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      profession: body.profession,
      profile_url: socialUrl || primaryUrl || null,
      site_url: siteUrl && !isSocialUrl(siteUrl) ? siteUrl : null,
      input_type: inputType,
    });

    const cr = analysis.client_report;
    const clientReport = await insertClientReport({
      lead_id: lead.id,
      report: cr,
    });

    const ir = analysis.internal_report;
    await insertInternalReport({
      lead_id: lead.id,
      client_report_id: clientReport.id,
      profession: body.profession,
      report: ir,
      raw_ai_response: {
        ...analysis,
        collected_urls: { social: socialUrl || null, site: siteUrl || null },
      },
    });

    await notifyCommercial({
      leadId: lead.id,
      name: body.name,
      profession: professionLabel,
      selo: cr.selo,
      score: cr.score_geral,
      resumo: ir.resumo_para_time_comercial,
    });

    return NextResponse.json({
      ok: true,
      lead_id: lead.id,
      client_report: {
        score_geral: cr.score_geral,
        score_lgpd: cr.score_lgpd,
        score_marco_civil: cr.score_marco_civil,
        score_etica_profissional: cr.score_etica_profissional,
        selo: cr.selo,
        cta_generico: cr.cta_generico,
        penalidades_resumo: cr.penalidades_resumo,
      },
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Erro interno';
    if (message.includes('API_KEY')) {
      return NextResponse.json({ error: 'IA não configurada no servidor.' }, { status: 503 });
    }
    if (err instanceof z.ZodError) {
      const detail = err.issues[0]?.message;
      return NextResponse.json(
        { error: detail || 'Dados inválidos.', details: err.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
