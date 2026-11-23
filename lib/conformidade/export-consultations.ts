import { professionToConselho } from './local-score';
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

const CSV_HEADERS = [
  'slug',
  'nome',
  'site',
  'instagram',
  'conselho',
  'observacao',
  'prioridade',
] as const;

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildSlug(row: ConsultationExportRow): string {
  let base = slugify(row.name);
  if (!base && row.site_url) {
    try {
      const host = new URL(
        row.site_url.startsWith('http') ? row.site_url : `https://${row.site_url}`
      ).hostname.replace(/^www\./i, '');
      base = slugify(host.split('.')[0] || host);
    } catch {
      base = '';
    }
  }
  if (!base) base = 'consulta';
  return base;
}

function instagramUrl(row: ConsultationExportRow): string {
  const candidates = [row.profile_url, row.site_url].filter(Boolean) as string[];
  for (const url of candidates) {
    if (/instagram\.com/i.test(url)) return url;
  }
  return '';
}

function siteUrl(row: ConsultationExportRow): string {
  if (row.site_url && !/instagram\.com/i.test(row.site_url)) {
    return row.site_url;
  }
  return '';
}

function buildObservacao(row: ConsultationExportRow): string {
  const parts: string[] = [];
  if (row.score_geral != null) parts.push(`Nota ${row.score_geral}`);
  if (row.selo) parts.push(row.selo);
  if (row.veredito) parts.push(row.veredito);
  const contact = row.phone || row.email;
  if (contact) parts.push(`Contato: ${contact}`);
  return parts.join(' · ');
}

function prioridadeFromRow(row: ConsultationExportRow): string {
  if (row.selo === 'Risco Crítico' || (row.score_geral != null && row.score_geral < 60)) {
    return 'alta';
  }
  if (row.selo === 'Risco Moderado' || (row.score_geral != null && row.score_geral < 85)) {
    return 'media';
  }
  return 'baixa';
}

export function consultationsToExcelCsv(rows: ConsultationExportRow[]): string {
  const seenSlugs = new Map<string, number>();
  const lines = [CSV_HEADERS.join(';')];

  for (const row of rows) {
    let slug = buildSlug(row);
    const count = seenSlugs.get(slug) || 0;
    if (count > 0) slug = `${slug}-${count + 1}`;
    seenSlugs.set(buildSlug(row), count + 1);

    lines.push(
      [
        slug,
        row.name,
        siteUrl(row),
        instagramUrl(row),
        professionToConselho(row.profession),
        buildObservacao(row),
        prioridadeFromRow(row),
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