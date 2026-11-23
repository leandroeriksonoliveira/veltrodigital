import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isDbConfigured } from '@/lib/conformidade/db';
import {
  insertClientReport,
  insertLead,
} from '@/lib/conformidade/repository';
import { runLocalComplianceAnalysis } from '@/lib/conformidade/run-local-analysis';
import { extractInstagramFromHtml } from '@/lib/conformidade/discover-socials';
import { fetchSiteEvidence, type SiteEvidence } from '@/lib/conformidade/site-audit';
import {
  fetchSocialProfileEvidence,
  isInstagramUrl,
  isSocialUrl,
  type SocialEvidence,
} from '@/lib/conformidade/social-audit';
import { notifyCommercial } from '@/lib/conformidade/notify';
import { PROFESSION_LABELS, type InputType, type Profession } from '@/lib/conformidade/types';

export const runtime = 'nodejs';
export const maxDuration = 90;

const BodySchema = z
  .object({
    name: z.string().trim().max(120).optional().default(''),
    email: z.string().trim().email().optional().or(z.literal('')),
    phone: z.string().trim().max(40).optional().default(''),
    profession: z
      .enum([
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
      ])
      .optional()
      .default('outro'),
    profile_url: z.string().max(500).optional().default(''),
    site_url: z.string().trim().min(3).max(500),
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

function nameFromSite(url: string): string {
  try {
    const host = new URL(normalizeUrl(url)).hostname.replace(/^www\./i, '');
    const label = host.split('.')[0] || host;
    return label
      .split(/[-_]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .slice(0, 80);
  } catch {
    return 'Lead site';
  }
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
    const leadName = (body.name || '').trim() || nameFromSite(siteUrl || socialUrl);

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

    if (!siteUrl && !socialUrl) {
      return NextResponse.json(
        { error: 'Informe o link do site para gerar a nota.' },
        { status: 400 }
      );
    }

    // 1) Site primeiro (páginas legais + HTML para descobrir Instagram)
    let siteEvidence: SiteEvidence | null = null;
    if (siteUrl && !isSocialUrl(siteUrl)) {
      siteEvidence = await fetchSiteEvidence(siteUrl);
    }

    // 2) Instagram: campo do formulário OU link encontrado no HTML do site (paridade com o lote)
    if (!socialUrl && siteEvidence?.html) {
      const discovered = extractInstagramFromHtml(
        siteEvidence.html,
        siteEvidence.finalUrl || siteUrl
      );
      if (discovered) socialUrl = discovered;
    }

    let socialEvidence: SocialEvidence | null = null;
    if (socialUrl) {
      socialEvidence = await fetchSocialProfileEvidence(socialUrl);
    }

    const hasContent =
      Boolean(siteEvidence?.textSample && siteEvidence.textSample.length >= 20) ||
      Boolean(socialEvidence?.textSample && socialEvidence.textSample.length >= 20) ||
      Boolean(socialEvidence?.bio && socialEvidence.bio.length >= 8);

    if (!hasContent) {
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

    // Nota inicial local (checklist + regras) — mesma lógica do lote Conformidade Digital
    const analysis = runLocalComplianceAnalysis({
      name: leadName,
      profession: body.profession,
      site: siteEvidence,
      social: socialEvidence,
    });

    const lead = await insertLead({
      name: leadName,
      email: body.email || null,
      phone: body.phone || null,
      profession: body.profession,
      profile_url: socialUrl || null,
      site_url: siteUrl && !isSocialUrl(siteUrl) ? siteUrl : null,
      input_type: inputType,
    });

    const cr = analysis.client_report;
    await insertClientReport({
      lead_id: lead.id,
      report: cr,
    });

    await notifyCommercial({
      leadId: lead.id,
      name: leadName,
      profession: professionLabel,
      selo: cr.selo,
      score: cr.score_geral,
      resumo: `${cr.veredito} · ${cr.cta_generico}`,
    });

    return NextResponse.json({
      ok: true,
      lead_id: lead.id,
      engine: 'local_rules_v1',
      client_report: {
        score_geral: cr.score_geral,
        score_lgpd: cr.score_lgpd,
        score_marco_civil: cr.score_marco_civil,
        score_etica_profissional: cr.score_etica_profissional,
        score_rede_social: cr.score_rede_social ?? null,
        score_site: cr.score_site ?? null,
        selo: cr.selo,
        veredito: cr.veredito,
        cta_generico: cr.cta_generico,
        scoreboard: cr.scoreboard,
        penalidades_resumo: cr.penalidades_resumo,
      },
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Erro interno';
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
