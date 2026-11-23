import { PROFESSION_LABELS, type Profession } from './types';

export type ConsultationExportRow = {
  id: string;
  created_at: string;
  site_url: string | null;
  profile_url: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  profession: string;
  input_type: string;
  score_geral: number | null;
  score_lgpd: number | null;
  score_marco_civil: number | null;
  score_etica_profissional: number | null;
  selo: string | null;
  veredito: string | null;
};

const INPUT_TYPE_LABELS: Record<string, string> = {
  site: 'Site',
  link_referencia: 'Rede social',
  misto: 'Site + rede',
  texto: 'Texto',
  imagem: 'Imagem',
};

function consultedUrl(row: ConsultationExportRow): string {
  if (row.site_url) return row.site_url;
  if (row.profile_url) return row.profile_url;
  return '';
}

function professionLabel(code: string): string {
  return PROFESSION_LABELS[code as Profession] || code;
}

function inputTypeLabel(code: string): string {
  return INPUT_TYPE_LABELS[code] || code;
}

function escapeCsvField(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[;"\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function formatDateBr(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return iso;
  }
}

const CSV_HEADERS = [
  'Data da consulta',
  'Site / URL consultada',
  'Rede social',
  'Nome',
  'E-mail',
  'WhatsApp',
  'Profissão',
  'Tipo de entrada',
  'Nota geral',
  'Selo',
  'Veredito',
  'Nota LGPD',
  'Nota Marco Civil',
  'Nota ética profissional',
];

export function consultationsToExcelCsv(rows: ConsultationExportRow[]): string {
  const lines = [CSV_HEADERS.map(escapeCsvField).join(';')];
  for (const row of rows) {
    lines.push(
      [
        formatDateBr(row.created_at),
        consultedUrl(row),
        row.profile_url || '',
        row.name,
        row.email || '',
        row.phone || '',
        professionLabel(row.profession),
        inputTypeLabel(row.input_type),
        row.score_geral ?? '',
        row.selo || '',
        row.veredito || '',
        row.score_lgpd ?? '',
        row.score_marco_civil ?? '',
        row.score_etica_profissional ?? '',
      ]
        .map(escapeCsvField)
        .join(';')
    );
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

export function consultationToListItem(row: ConsultationExportRow) {
  return {
    id: row.id,
    created_at: row.created_at,
    url_consultada: consultedUrl(row),
    site_url: row.site_url,
    profile_url: row.profile_url,
    name: row.name,
    email: row.email,
    phone: row.phone,
    profession: row.profession,
    profession_label: professionLabel(row.profession),
    input_type: row.input_type,
    input_type_label: inputTypeLabel(row.input_type),
    score_geral: row.score_geral,
    selo: row.selo,
    veredito: row.veredito,
  };
}