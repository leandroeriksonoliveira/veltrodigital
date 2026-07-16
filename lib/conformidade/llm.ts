import { z } from 'zod';
import type { AiAnalysisPayload } from './types';
import { seloFromScore } from './types';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';

const RedFlagSchema = z.object({
  trecho: z.string(),
  categoria: z.enum(['LGPD', 'Marco Civil', 'Etica_Profissional']),
  norma_violada: z.string(),
  explicacao: z.string(),
});

const AiSchema = z.object({
  profession: z.string(),
  client_report: z.object({
    score_geral: z.number().min(0).max(100),
    score_lgpd: z.number().min(0).max(100),
    score_marco_civil: z.number().min(0).max(100),
    score_etica_profissional: z.number().min(0).max(100),
    selo: z.enum(['Aprovado', 'Risco Moderado', 'Risco Crítico']),
    cta_generico: z.string(),
    penalidades_resumo: z
      .object({
        multa_anpd_max: z.string(),
        multa_pf_referencia: z.string(),
        suspensao_conselho: z.string(),
        riscos_imagem: z.string(),
        sanções_eticas: z.string().optional(),
        sancoes_eticas: z.string().optional(),
      })
      .passthrough(),
  }),
  internal_report: z.object({
    diagnostico_geral: z.string(),
    red_flags: z.array(RedFlagSchema),
    penalidades_estimadas: z.object({
      esfera_etica_conselho: z.string(),
      esfera_lgpd_anpd: z.string(),
      esfera_civil_criminal: z.string(),
    }),
    recomendacoes_correcao: z.string(),
    resumo_para_time_comercial: z.string(),
  }),
});

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Resposta da IA sem JSON');
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizePayload(data: z.infer<typeof AiSchema>): AiAnalysisPayload {
  const pr = data.client_report.penalidades_resumo;
  const sancoes = pr.sanções_eticas || pr.sancoes_eticas || 'Advertência, censura, suspensão ou cassação conforme o conselho';
  let selo = data.client_report.selo;
  const score = Math.round(data.client_report.score_geral);
  const expected = seloFromScore(score);
  if (score < 60) selo = 'Risco Crítico';
  else if (selo === 'Aprovado' && score < 85) selo = expected;

  return {
    profession: data.profession,
    client_report: {
      score_geral: score,
      score_lgpd: Math.round(data.client_report.score_lgpd),
      score_marco_civil: Math.round(data.client_report.score_marco_civil),
      score_etica_profissional: Math.round(data.client_report.score_etica_profissional),
      selo,
      cta_generico:
        data.client_report.cta_generico ||
        'Identificamos pontos de atenção no seu perfil. Fale com um especialista da Veltro Digital.',
      penalidades_resumo: {
        multa_anpd_max: pr.multa_anpd_max || 'Até 2% do faturamento, teto R$ 50.000.000 por infração (LGPD Art. 52)',
        multa_pf_referencia: pr.multa_pf_referencia || 'Referência PF grave: até ~R$ 12.000 (dosimetria ANPD)',
        suspensao_conselho: pr.suspensao_conselho || 'Suspensão ética/disciplinar conforme conselho de classe',
        riscos_imagem: pr.riscos_imagem || 'Publicização da infração e dano reputacional',
        sanções_eticas: sancoes,
      },
    },
    internal_report: data.internal_report,
  };
}

async function callOpenAI(system: string, user: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY não configurada');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error: ${res.status} ${err}`);
  }
  const json = await res.json();
  const block = (json.content || []).find((c: { type: string }) => c.type === 'text');
  return block?.text || '';
}

export async function runComplianceAnalysis(input: {
  name: string;
  profession: string;
  professionLabel: string;
  inputType: string;
  profileUrl?: string;
  contentText: string;
  siteSummary?: string;
}): Promise<AiAnalysisPayload> {
  const user = buildUserPrompt(input);
  let raw: string;
  if (process.env.OPENAI_API_KEY) {
    raw = await callOpenAI(SYSTEM_PROMPT, user);
  } else if (process.env.ANTHROPIC_API_KEY) {
    raw = await callAnthropic(SYSTEM_PROMPT, user);
  } else {
    throw new Error('Configure OPENAI_API_KEY ou ANTHROPIC_API_KEY');
  }
  const parsed = AiSchema.parse(extractJson(raw));
  return normalizePayload(parsed);
}
