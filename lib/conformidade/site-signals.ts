/**
 * Extração de sinais do HTML — alinhada a Conformidade Digital/collect._extract_site_signals
 */

export interface SiteFormField {
  tag: string;
  type?: string | null;
  name?: string | null;
  id?: string | null;
  placeholder?: string | null;
}

export interface SiteForm {
  action?: string | null;
  method?: string | null;
  fields: SiteFormField[];
}

export interface SiteSignals {
  title: string;
  metas: Record<string, string>;
  legal_links: { text: string; href: string }[];
  forms_count: number;
  forms: SiteForm[];
  crm_matches: string[];
  crp_matches: string[];
  rqe_matches: string[];
  cro_matches: string[];
  forbidden_hits: string[];
  https: boolean;
  has_privacy_link: boolean;
  has_terms_link: boolean;
  has_cookie_hint: boolean;
  sensitive_form_suspected: boolean;
  text_length: number;
  visible_text: string;
}

const LEGAL_HINTS = ['privacidade', 'privacy', 'cookies', 'termos', 'lgpd'];

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutize(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function uniqueMatches(text: string, re: RegExp): string[] {
  const out = new Set<string>();
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const global = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = global.exec(text))) {
    out.add(m[0]);
  }
  return [...out];
}

export function extractSiteSignals(html: string, baseUrl: string): SiteSignals {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]).slice(0, 200) : '';

  const metas: Record<string, string> = {};
  const metaRe =
    /<meta\b[^>]*(?:(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']*)["']|content=["']([^"']*)["'][^>]*(?:property|name)=["']([^"']+)["'])[^>]*>/gi;
  let mm: RegExpExecArray | null;
  while ((mm = metaRe.exec(html))) {
    const key = (mm[1] || mm[4] || '').toLowerCase();
    const content = mm[2] || mm[3] || '';
    if (key && content) metas[key] = content.slice(0, 500);
  }

  const legal_links: { text: string; href: string }[] = [];
  const aRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = aRe.exec(html))) {
    const href = am[1].trim();
    const text = stripTags(am[2]).slice(0, 120);
    const blob = `${text} ${href}`.toLowerCase();
    if (LEGAL_HINTS.some((h) => blob.includes(h))) {
      legal_links.push({ text, href: absolutize(baseUrl, href) });
      if (legal_links.length >= 20) break;
    }
  }

  const forms: SiteForm[] = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = formRe.exec(html))) {
    const attrs = fm[1] || '';
    const body = fm[2] || '';
    const action = attrs.match(/\baction=["']([^"']*)["']/i)?.[1] ?? null;
    const method = attrs.match(/\bmethod=["']([^"']*)["']/i)?.[1] ?? null;
    const fields: SiteFormField[] = [];
    const fieldRe = /<(input|textarea|select)\b([^>]*)\/?>/gi;
    let ff: RegExpExecArray | null;
    while ((ff = fieldRe.exec(body))) {
      const fattrs = ff[2] || '';
      fields.push({
        tag: ff[1].toLowerCase(),
        type: fattrs.match(/\btype=["']([^"']*)["']/i)?.[1] ?? null,
        name: fattrs.match(/\bname=["']([^"']*)["']/i)?.[1] ?? null,
        id: fattrs.match(/\bid=["']([^"']*)["']/i)?.[1] ?? null,
        placeholder: fattrs.match(/\bplaceholder=["']([^"']*)["']/i)?.[1] ?? null,
      });
      if (fields.length >= 40) break;
    }
    forms.push({ action, method, fields });
    if (forms.length >= 10) break;
  }

  const text = stripTags(html).slice(0, 20000);
  const text_l = text.toLowerCase();

  const forbidden_hits: string[] = [];
  const patterns: Record<string, RegExp> = {
    depoimento_estrelas: /\b(\d\s*estrelas?|5\s*estrelas|depoimento|avalia[cç][aã]o de pacientes?)\b/i,
    antes_depois: /\b(antes\s*e\s*depois|antes\/depois|antes\s*&\s*depois)\b/i,
    promessa: /\b(resultado\s+garantido|cura\s+garantida|100\s*%\s*eficaz|milagre|elimine sua dor)\b/i,
    preco: /(r\$\s*\d|a\s+partir\s+de\s+r\$|pre[cç]o\s+da\s+consulta|tabela\s+de\s+pre[cç]os)/i,
    melhor_medico: /\b(melhor\s+m[eé]dic[oa]|n[uú]mero\s+1\s+em|refer[eê]ncia\s+nacional)\b/i,
    contagem_pacientes: /\b(\d+\s*\+?\s*pacientes?|mais de \d+ pacientes)\b/i,
  };
  for (const [key, pat] of Object.entries(patterns)) {
    if (pat.test(text_l)) forbidden_hits.push(key);
  }

  let sensitive_form_suspected = false;
  for (const form of forms) {
    const blob = JSON.stringify(form).toLowerCase();
    if (['sintoma', 'anamnese', 'queixa', 'doen', 'diagn', 'medicamento', 'cid'].some((k) => blob.includes(k))) {
      sensitive_form_suspected = true;
      break;
    }
  }

  let https = false;
  try {
    https = new URL(baseUrl).protocol === 'https:';
  } catch {
    https = baseUrl.startsWith('https://');
  }

  return {
    title,
    metas,
    legal_links,
    forms_count: forms.length,
    forms,
    crm_matches: uniqueMatches(text, /\bCRM\s*\/?\s*[A-Z]{2}\s*\d{2,7}\b/i).slice(0, 10),
    crp_matches: uniqueMatches(text, /\bCRP[-\s]?\d{1,2}\s*\/\s*\d{2,7}(?:-\d)?\b/i).slice(0, 10),
    rqe_matches: uniqueMatches(text, /\bRQE\s*[:\-]?\s*\d{2,7}\b/i).slice(0, 10),
    cro_matches: uniqueMatches(text, /\bCRO\s*\/?\s*[A-Z]{2}\s*\d{2,7}\b/i).slice(0, 10),
    forbidden_hits,
    https,
    has_privacy_link: legal_links.some((x) => `${x.text} ${x.href}`.toLowerCase().includes('privacidade')),
    has_terms_link: legal_links.some((x) => `${x.text} ${x.href}`.toLowerCase().includes('termo')),
    has_cookie_hint: text_l.includes('cookie'),
    sensitive_form_suspected,
    text_length: text.length,
    visible_text: text,
  };
}
