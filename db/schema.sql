-- Analisador de Conformidade Digital — Veltro Digital
-- Postgres na Vercel (Neon Marketplace)
-- Aplique via: Neon Console SQL Editor ou `psql $DATABASE_URL -f db/schema.sql`

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  profession text NOT NULL,
  profile_url text,
  input_type text NOT NULL CHECK (input_type IN ('texto', 'imagem', 'site', 'link_referencia')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score_geral int NOT NULL CHECK (score_geral BETWEEN 0 AND 100),
  score_lgpd int NOT NULL CHECK (score_lgpd BETWEEN 0 AND 100),
  score_marco_civil int NOT NULL CHECK (score_marco_civil BETWEEN 0 AND 100),
  score_etica_profissional int NOT NULL CHECK (score_etica_profissional BETWEEN 0 AND 100),
  selo text NOT NULL CHECK (selo IN ('Aprovado', 'Risco Moderado', 'Risco Crítico')),
  cta_generico text NOT NULL,
  penalidades_resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS internal_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_report_id uuid REFERENCES client_reports(id) ON DELETE SET NULL,
  profession text NOT NULL,
  diagnostico_geral text NOT NULL,
  red_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  penalidades_estimadas jsonb NOT NULL DEFAULT '{}'::jsonb,
  recomendacoes_correcao text NOT NULL,
  resumo_para_time_comercial text NOT NULL,
  raw_ai_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_reports_lead ON client_reports(lead_id);
CREATE INDEX IF NOT EXISTS idx_internal_reports_lead ON internal_reports(lead_id);
