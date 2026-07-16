import { getSql } from './db';
import type { ClientReport, InternalReport } from './types';

export type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profession: string;
  profile_url: string | null;
  site_url: string | null;
  input_type: string;
  created_at: string;
};

export type ClientReportRow = {
  id: string;
  lead_id: string;
  score_geral: number;
  score_lgpd: number;
  score_marco_civil: number;
  score_etica_profissional: number;
  selo: string;
  cta_generico: string;
  penalidades_resumo: ClientReport['penalidades_resumo'];
  created_at: string;
};

export type InternalReportRow = {
  id: string;
  lead_id: string;
  client_report_id: string | null;
  profession: string;
  diagnostico_geral: string;
  red_flags: InternalReport['red_flags'];
  penalidades_estimadas: InternalReport['penalidades_estimadas'] & {
    scoreboard?: InternalReport['scoreboard'];
    penalidades_tabela?: InternalReport['penalidades_tabela'];
    plano_acao?: InternalReport['plano_acao'];
    itens?: InternalReport['itens'];
    analise_rede_social?: string;
    analise_site?: string;
    veredito?: string;
  };
  recomendacoes_correcao: string;
  resumo_para_time_comercial: string;
  raw_ai_response?: unknown;
  created_at: string;
};

export async function insertLead(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  profession: string;
  profile_url?: string | null;
  site_url?: string | null;
  input_type: string;
}): Promise<LeadRow> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO leads (name, email, phone, profession, profile_url, site_url, input_type)
    VALUES (
      ${input.name},
      ${input.email || null},
      ${input.phone || null},
      ${input.profession},
      ${input.profile_url || null},
      ${input.site_url || null},
      ${input.input_type}
    )
    RETURNING *
  `;
  return rows[0] as LeadRow;
}

export async function insertClientReport(input: {
  lead_id: string;
  report: ClientReport;
}): Promise<ClientReportRow> {
  const sql = getSql();
  const r = input.report;
  const penalidadesPack = {
    ...r.penalidades_resumo,
    scoreboard: r.scoreboard,
    veredito: r.veredito,
    score_rede_social: r.score_rede_social ?? null,
    score_site: r.score_site ?? null,
  };
  const rows = await sql`
    INSERT INTO client_reports (
      lead_id, score_geral, score_lgpd, score_marco_civil, score_etica_profissional,
      selo, cta_generico, penalidades_resumo
    )
    VALUES (
      ${input.lead_id},
      ${r.score_geral},
      ${r.score_lgpd},
      ${r.score_marco_civil},
      ${r.score_etica_profissional},
      ${r.selo},
      ${r.cta_generico},
      ${JSON.stringify(penalidadesPack)}::jsonb
    )
    RETURNING *
  `;
  return rows[0] as ClientReportRow;
}

export async function insertInternalReport(input: {
  lead_id: string;
  client_report_id: string;
  profession: string;
  report: InternalReport;
  raw_ai_response: unknown;
}): Promise<void> {
  const sql = getSql();
  const r = input.report;
  // Empacota campos novos da skill no jsonb existente (sem migration)
  const penalidadesPack = {
    ...r.penalidades_estimadas,
    scoreboard: r.scoreboard,
    penalidades_tabela: r.penalidades_tabela,
    plano_acao: r.plano_acao,
    itens: r.itens,
    analise_rede_social: r.analise_rede_social,
    analise_site: r.analise_site,
    veredito: r.veredito,
  };
  await sql`
    INSERT INTO internal_reports (
      lead_id, client_report_id, profession, diagnostico_geral, red_flags,
      penalidades_estimadas, recomendacoes_correcao, resumo_para_time_comercial, raw_ai_response
    )
    VALUES (
      ${input.lead_id},
      ${input.client_report_id},
      ${input.profession},
      ${r.diagnostico_geral},
      ${JSON.stringify(r.red_flags)}::jsonb,
      ${JSON.stringify(penalidadesPack)}::jsonb,
      ${r.recomendacoes_correcao},
      ${r.resumo_para_time_comercial},
      ${JSON.stringify(input.raw_ai_response)}::jsonb
    )
  `;
}

export async function listLeadsWithReports(limit = 100) {
  const sql = getSql();
  return sql`
    SELECT
      l.id,
      l.name,
      l.email,
      l.phone,
      l.profession,
      l.profile_url,
      l.site_url,
      l.input_type,
      l.created_at,
      c.score_geral,
      c.selo,
      i.resumo_para_time_comercial
    FROM leads l
    LEFT JOIN LATERAL (
      SELECT score_geral, selo, created_at
      FROM client_reports
      WHERE lead_id = l.id
      ORDER BY created_at DESC
      LIMIT 1
    ) c ON true
    LEFT JOIN LATERAL (
      SELECT resumo_para_time_comercial, created_at
      FROM internal_reports
      WHERE lead_id = l.id
      ORDER BY created_at DESC
      LIMIT 1
    ) i ON true
    ORDER BY l.created_at DESC
    LIMIT ${limit}
  `;
}

export async function getLeadBundle(leadId: string) {
  const sql = getSql();
  const leads = await sql`SELECT * FROM leads WHERE id = ${leadId} LIMIT 1`;
  const clients = await sql`
    SELECT * FROM client_reports
    WHERE lead_id = ${leadId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const internals = await sql`
    SELECT * FROM internal_reports
    WHERE lead_id = ${leadId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return {
    lead: (leads[0] as LeadRow) || null,
    client_report: (clients[0] as ClientReportRow) || null,
    internal_report: (internals[0] as InternalReportRow) || null,
  };
}
