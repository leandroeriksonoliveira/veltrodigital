-- Migração: suporte a site_url + input_type misto
ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_url text;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_input_type_check;
ALTER TABLE leads ADD CONSTRAINT leads_input_type_check
  CHECK (input_type IN ('texto', 'imagem', 'site', 'link_referencia', 'misto'));
