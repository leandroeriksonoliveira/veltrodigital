import { z } from 'zod';
import type { AiAnalysisPayload, Scoreboard } from './types';
import { seloFromScore, vereditoFromScoreboard } from './types';
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

const AuditItemSchema = z.object({
  id: z.string(),
  superficie: z.enum(['rede_social', 'site', 'transversal']),
  secao: z.string(),
  titulo: z.string(),
  status: z.enum(['conforme', 'atencao', 'nao_conforme', 'critico', 'na']),
  evidencia: z.string().default(''),
  norma: z.string().default(''),
  acao: z.string().default(''),
  penalidade_possivel: z.string().default(''),
  risco: z.enum(['alto', 'medio', 'baixo', 'na']).default('na'),
});

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
  internal_report: z.object({
    diagnostico_geral: z.string(),
    veredito: z.string().optional(),
    scoreboard: ScoreboardSchema.optional(),
    analise_rede_social: z.string().optional().default(''),
    analise_site: z.string().optional().default(''),
    itens: z.array(AuditItemSchema).optional().default([]),
    red_flags: z.array(RedFlagSchema).default([]),
    penalidades_estimadas: z.object({
      esfera_etica_conselho: z.string(),
      esfera_lgpd_anpd: z.string(),
      esfera_civil_criminal: z.string(),
    }),
    penalidades_tabela: z
      .array(
        z.object({
          esfera: z.string(),
          consequencia: z.string(),
          fundamentacao: z.string(),
        })
      )
      .optional()
      .default([]),
    plano_acao: z
      .object({
        dias_7: z.array(z.string()).default([]),
        dias_15: z.array(z.string()).default([]),
        dias_30: z.array(z.string()).default([]),
      })
      .optional()
      .default({ dias_7: [], dias_15: [], dias_30: [] }),
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

function recomputeScoreboard(
  itens: z.infer<typeof AuditItemSchema>[],
  fallback?: Scoreboard
): Scoreboard {
  const applicable = itens.filter((i) => i.status !== 'na');
  if (!applicable.length && fallback) return fallback;

  const conformes = applicable.filter((i) => i.status === 'conforme').length;
  const atencao = applicable.filter((i) => i.status === 'atencao').length;
  const nao_conformes = applicable.filter((i) => i.status === 'nao_conforme').length;
  const criticos = applicable.filter((i) => i.status === 'critico').length;
  const total = applicable.length || 1;
  const indice = Math.round((conformes / total) * 100);

  return {
    total_avaliados: applicable.length,
    conformes,
    atencao,
    nao_conformes,
    criticos,
    indice,
    infracoes_mapeadas: nao_conformes + criticos,
    riscos_alta: criticos + applicable.filter((i) => i.risco === 'alto').length,
    riscos_media: atencao,
    riscos_reputacionais: applicable.some(
      (i) =>
        /depoimento|estrela|antes.?depois|sensacional|reput/i.test(i.titulo) &&
        (i.status === 'critico' || i.status === 'nao_conforme' || i.status === 'atencao')
    )
      ? 1
      : fallback?.riscos_reputacionais || 0,
  };
}

function surfaceScore(
  itens: z.infer<typeof AuditItemSchema>[],
  surface: 'rede_social' | 'site'
): number | null {
  const list = itens.filter((i) => i.superficie === surface && i.status !== 'na');
  if (!list.length) return null;
  const ok = list.filter((i) => i.status === 'conforme').length;
  return Math.round((ok / list.length) * 100);
}

function normalizePayload(data: z.infer<typeof AiSchema>): AiAnalysisPayload {
  const pr = data.client_report.penalidades_resumo;
  const sancoes =
    pr.sanções_eticas ||
    pr.sancoes_eticas ||
    'Advertência, censura, suspensão ou cassação conforme o conselho';

  const itens = data.internal_report.itens || [];
  const scoreboard = recomputeScoreboard(
    itens,
    data.internal_report.scoreboard || data.client_report.scoreboard
  );

  let score = Math.round(data.client_report.score_geral);
  if (itens.length) score = scoreboard.indice;

  const veredito =
    data.internal_report.veredito ||
    data.client_report.veredito ||
    vereditoFromScoreboard(scoreboard);

  let selo = data.client_report.selo;
  if (scoreboard.criticos >= 1 || score < 60) selo = 'Risco Crítico';
  else if (score >= 85) selo = 'Aprovado';
  else selo = 'Risco Moderado';

  // Garantir red_flags a partir de itens críticos/não conformes se vazio
  let redFlags = data.internal_report.red_flags;
  if (!redFlags.length) {
    redFlags = itens
      .filter((i) => i.status === 'critico' || i.status === 'nao_conforme')
      .slice(0, 12)
      .map((i) => ({
        trecho: i.evidencia || i.titulo,
        categoria: /lgpd|dado|cookie|privacidade/i.test(i.secao + i.norma)
          ? ('LGPD' as const)
          : /marco civil/i.test(i.norma)
            ? ('Marco Civil' as const)
            : ('Etica_Profissional' as const),
        norma_violada: i.norma || 'Norma profissional / LGPD',
        explicacao: i.penalidade_possivel || i.acao || i.titulo,
      }));
  }

  const plano = data.internal_report.plano_acao || { dias_7: [], dias_15: [], dias_30: [] };
  const recomendacoes =
    data.internal_report.recomendacoes_correcao ||
    [
      '7 dias:',
      ...plano.dias_7.map((a) => `- ${a}`),
      '15 dias:',
      ...plano.dias_15.map((a) => `- ${a}`),
      '30 dias:',
      ...plano.dias_30.map((a) => `- ${a}`),
    ].join('\n');

  return {
    profession: data.profession,
    client_report: {
      score_geral: score,
      score_lgpd: Math.round(data.client_report.score_lgpd),
      score_marco_civil: Math.round(data.client_report.score_marco_civil),
      score_etica_profissional: Math.round(data.client_report.score_etica_profissional),
      score_rede_social:
        data.client_report.score_rede_social ?? surfaceScore(itens, 'rede_social'),
      score_site: data.client_report.score_site ?? surfaceScore(itens, 'site'),
      selo: selo || seloFromScore(score),
      veredito,
      cta_generico:
        data.client_report.cta_generico ||
        'Identificamos pontos de atenção no seu perfil digital. Fale com um especialista da Veltro Digital.',
      scoreboard,
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
    },
    internal_report: {
      diagnostico_geral: data.internal_report.diagnostico_geral,
      veredito,
      scoreboard,
      itens,
      red_flags: redFlags,
      penalidades_estimadas: data.internal_report.penalidades_estimadas,
      penalidades_tabela: data.internal_report.penalidades_tabela || [],
      plano_acao: plano,
      recomendacoes_correcao: recomendacoes,
      resumo_para_time_comercial: data.internal_report.resumo_para_time_comercial,
      analise_rede_social:
        data.internal_report.analise_rede_social ||
        'Análise de rede social não fornecida pela IA.',
      analise_site: data.internal_report.analise_site || 'N/A — site não informado.',
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
      max_tokens: 8192,
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
