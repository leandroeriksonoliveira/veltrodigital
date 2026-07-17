import { z } from 'zod';
import type { AiAnalysisPayload, ClientReport, Scoreboard } from './types';
import { seloFromScore } from './types';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';

const ScoreboardSchema = z.object({
  total_avaliados: z.number().min(0),
  conformes: z.number().min(0),
  atencao: z.number().min(0).default(0),
  nao_conformes: z.number().min(0).default(0),
  criticos: z.number().min(0).default(0),
  indice: z.number().min(0).max(100),
  infracoes_mapeadas: z.number().min(0).default(0),
  riscos_alta: z.number().min(0).default(0),
  riscos_media: z.number().min(0).default(0),
  riscos_reputacionais: z.number().min(0).default(0),
});

const AiSchema = z.object({
  profession: z.string().optional(),
  client_report: z.object({
    score_geral: z.number().min(0).max(100),
    score_lgpd: z.number().min(0).max(100),
    score_marco_civil: z.number().min(0).max(100),
    score_etica_profissional: z.number().min(0).max(100),
    score_rede_social: z.number().min(0).max(100).nullable().optional(),
    score_site: z.number().min(0).max(100).nullable().optional(),
    selo: z.enum(['Aprovado', 'Risco Moderado', 'Risco Crítico']),
    veredito: z.string().optional(),
    cta_generico: z.string(),
    scoreboard: ScoreboardSchema.optional(),
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

function defaultScoreboard(score: number): Scoreboard {
  const total = 24;
  const conformes = Math.round((score / 100) * total);
  const restante = Math.max(0, total - conformes);
  const criticos = score < 60 ? Math.max(1, Math.round(restante * 0.35)) : 0;
  const nao_conformes = Math.max(0, Math.round(restante * 0.45) - (score < 60 ? 0 : 0));
  const atencao = Math.max(0, restante - criticos - nao_conformes);
  return {
    total_avaliados: total,
    conformes,
    atencao,
    nao_conformes,
    criticos,
    indice: score,
    infracoes_mapeadas: nao_conformes + criticos,
    riscos_alta: criticos,
    riscos_media: atencao,
    riscos_reputacionais: score < 70 ? 1 : 0,
  };
}

function normalizeClientReport(
  data: z.infer<typeof AiSchema>['client_report'],
  profession: string
): ClientReport {
  const pr = data.penalidades_resumo;
  const sancoes =
    pr.sanções_eticas ||
    pr.sancoes_eticas ||
    'Advertência, censura, suspensão ou cassação conforme o conselho';

  let score = Math.round(data.score_geral);
  const sb = data.scoreboard
    ? {
        ...data.scoreboard,
        indice: Math.round(data.scoreboard.indice || score),
      }
    : defaultScoreboard(score);

  if (data.scoreboard) score = Math.round(data.scoreboard.indice || score);

  let selo = data.selo;
  if (sb.criticos >= 1 || score < 60) selo = 'Risco Crítico';
  else if (score >= 85) selo = 'Aprovado';
  else selo = 'Risco Moderado';

  const veredito =
    data.veredito ||
    (selo === 'Aprovado'
      ? 'Conforme'
      : selo === 'Risco Moderado'
        ? 'Aprovado com Ressalvas'
        : 'Não Conforme');

  return {
    score_geral: score,
    score_lgpd: Math.round(data.score_lgpd),
    score_marco_civil: Math.round(data.score_marco_civil),
    score_etica_profissional: Math.round(data.score_etica_profissional),
    score_rede_social: data.score_rede_social ?? null,
    score_site: data.score_site ?? null,
    selo: selo || seloFromScore(score),
    veredito,
    cta_generico:
      data.cta_generico ||
      'Identificamos pontos de atenção no seu perfil digital. Fale com um especialista da Veltro Digital.',
    scoreboard: sb,
    penalidades_resumo: {
      multa_anpd_max:
        pr.multa_anpd_max ||
        'Até 2% do faturamento, teto R$ 50.000.000 por infração (LGPD Art. 52)',
      multa_pf_referencia:
        pr.multa_pf_referencia || 'Referência PF grave: até ~R$ 12.000 (dosimetria ANPD)',
      suspensao_conselho:
        pr.suspensao_conselho || 'Suspensão ética/disciplinar conforme conselho de classe',
      riscos_imagem: pr.riscos_imagem || 'Publicização da infração e dano reputacional',
      sanções_eticas: sancoes,
    },
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
      temperature: 0.15,
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
      max_tokens: 2048,
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
  const client_report = normalizeClientReport(
    parsed.client_report,
    parsed.profession || input.profession
  );
  return {
    profession: parsed.profession || input.profession,
    client_report,
  };
}
