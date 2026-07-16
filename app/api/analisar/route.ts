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
import { notifyCommercial } from '@/lib/conformidade/notify';
import { PROFESSION_LABELS, type Profession } from '@/lib/conformidade/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
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
  profile_url: z.string().url().optional().or(z.literal('')),
  input_type: z.enum(['texto', 'imagem', 'site', 'link_referencia']),
  content_text: z.string().max(30000).optional(),
  image_base64: z.string().max(4_000_000).optional(),
  site_url: z.string().optional(),
  consent: z.literal(true),
});

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

    let contentText = (body.content_text || '').trim();
    let siteSummary: string | undefined;
    let profileUrl = body.profile_url || body.site_url || '';
    let inputType = body.input_type;

    if (body.input_type === 'site' || body.site_url) {
      const url = body.site_url || body.profile_url;
      if (!url) {
        return NextResponse.json({ error: 'Informe a URL do site institucional.' }, { status: 400 });
      }
      const evidence = await fetchSiteEvidence(url);
      siteSummary = evidence.summary;
      contentText = contentText
        ? `${contentText}\n\n--- Conteúdo extraído do site ---\n${evidence.textSample}`
        : evidence.textSample;
      profileUrl = evidence.finalUrl;
      inputType = 'site';
    }

    if (body.input_type === 'link_referencia' && !contentText) {
      return NextResponse.json(
        {
          error:
            'Por políticas das plataformas, não fazemos scraping automático. Cole a bio/post ou envie um print do conteúdo.',
          code: 'MANUAL_CONTENT_REQUIRED',
        },
        { status: 400 }
      );
    }

    if (body.input_type === 'imagem' && body.image_base64) {
      contentText =
        contentText ||
        '[Usuário enviou print/imagem do post. Analisar com base na descrição/texto fornecido junto à imagem e nas normas da profissão. Se o texto estiver vazio, indicar no internal_report a necessidade de revisão humana do print.]';
    }

    if (!contentText || contentText.length < 20) {
      return NextResponse.json(
        {
          error:
            'Envie o texto da bio/post, o conteúdo do site, ou uma descrição do print (mín. 20 caracteres).',
        },
        { status: 400 }
      );
    }

    const professionLabel = PROFESSION_LABELS[body.profession as Profession];
    const analysis = await runComplianceAnalysis({
      name: body.name,
      profession: body.profession,
      professionLabel,
      inputType,
      profileUrl,
      contentText,
      siteSummary,
    });

    const lead = await insertLead({
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      profession: body.profession,
      profile_url: profileUrl || null,
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
      raw_ai_response: analysis,
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
      return NextResponse.json({ error: 'Dados inválidos.', details: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
