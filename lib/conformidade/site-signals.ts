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
  has_cookie_banner: boolean;
  /** Analytics, pixels e similares — só estes justificam exigir banner */
  uses_tracking_cookies: boolean;
  tracking_hits: string[];
  /** Páginas legais lidas (privacidade/termos) — DPO costuma estar aqui */
  legal_pages_fetched?: { href: string; ok: boolean; text_len: number }[];
  /** mailto/tel/wa.me, placeholders e data-* de contato */
  contact_hints?: string[];
  has_form_consent: boolean;
  has_accessibility: boolean;
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

function contactHintsFromSource(source: string): string {
  if (!source) return '';
  const emails = source.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
  const phones = source.match(/\(?\d{2}\)?\s*\d{4,5}-?\d{4}/g) || [];
  const bits = [...new Set([...emails, ...phones])];
  if (/encarregado|\bdpo\b/i.test(source)) bits.push('Encarregado de dados (DPO)');
  const cnpj = source.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  if (cnpj) bits.push(cnpj[0]);
  return bits.join(' ');
}

function detectCookieBanner(html: string, textL: string, extraSource: string): boolean {
  const blob = `${html}\n${extraSource}`.toLowerCase();
  const hasBanner =
    blob.includes('cookie-banner') ||
    blob.includes('banner de cookies') ||
    blob.includes('cookies e privacidade');
  const hasAccept = /\b(aceitar|accept|permitir|allow)\b/.test(blob);
  const hasReject = /\b(recusar|reject|refuse|rejeitar|decline)\b/.test(blob);
  return Boolean(
    hasBanner &&
      hasAccept &&
      hasReject &&
      (blob.includes('cookie') || textL.includes('cookie'))
  );
}

const TRACKER_PATTERNS: { id: string; re: RegExp }[] = [
  { id: 'googletagmanager', re: /googletagmanager\.com/i },
  { id: 'google-analytics', re: /google-analytics\.com|analytics\.js|gtag\s*\(/i },
  { id: 'gtm', re: /gtm\.js/i },
  { id: 'meta-pixel', re: /connect\.facebook\.net|fbevents\.js|\bfbq\s*\(/i },
  { id: 'hotjar', re: /hotjar\.com|static\.hotjar/i },
  { id: 'clarity', re: /clarity\.ms/i },
  { id: 'linkedin-insight', re: /linkedin\.com\/px|snap\.licdn\.com/i },
  { id: 'tiktok-pixel', re: /analytics\.tiktok|tiktok\.com\/i18n\/pixel/i },
  { id: 'segment', re: /cdn\.segment\.|segment\.(com|io)/i },
  { id: 'mixpanel', re: /mixpanel\.com/i },
  { id: 'doubleclick', re: /doubleclick\.net/i },
];

function detectTrackingCookies(html: string, extraSource: string): { uses: boolean; hits: string[] } {
  const blob = `${html}\n${extraSource}`;
  const hits: string[] = [];
  for (const { id, re } of TRACKER_PATTERNS) {
    if (re.test(blob)) hits.push(id);
  }
  return { uses: hits.length > 0, hits };
}

function detectFormConsent(html: string): boolean {
  const formRe = /<form\b[^>]*>[\s\S]*?<\/form>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = formRe.exec(html))) {
    const formHtml = fm[0].toLowerCase();
    const hasCheckbox = /<input\b[^>]*type=["']checkbox["']/i.test(fm[0]);
    const privacyRef =
      formHtml.includes('privacidade') ||
      formHtml.includes('privacy') ||
      formHtml.includes('lgpd') ||
      formHtml.includes('consent') ||
      formHtml.includes('concordo');
    if (hasCheckbox && privacyRef) return true;
  }
  return false;
}

function detectAccessibility(html: string, textL: string, extraSource: string, legalLinks: { text: string; href: string }[]): boolean {
  const blob = `${html}\n${extraSource}`.toLowerCase();
  const hasSkip = /skip-link|href=["']#main-content["']/i.test(html);
  const hasUi =
    blob.includes('a11y-toolbar') ||
    blob.includes('a11y-panel') ||
    textL.includes('acessibilidade') ||
    textL.includes('accessibility');
  const hasPage = legalLinks.some((x) => /acessib|accessib/.test(`${x.text} ${x.href}`.toLowerCase()));
  return hasSkip || hasUi || hasPage;
}

export function extractSiteSignals(html: string, baseUrl: string, extraSource = ''): SiteSignals {
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

  const text = `${stripTags(html)} ${contactHintsFromSource(extraSource)}`.replace(/\s+/g, ' ').trim().slice(0, 20000);
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

  const tracking = detectTrackingCookies(html, extraSource);

  const contact_hints: string[] = [];
  const hrefContactRe = /href=["']((?:mailto:|tel:)[^"']+|[^"']*(?:wa\.me\/|whatsapp)[^"']*)["']/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hrefContactRe.exec(html))) {
    contact_hints.push(hm[1]);
  }
  const dataContactRe = /data-(?:email|phone|whatsapp)=["']([^"']+)["']/gi;
  while ((hm = dataContactRe.exec(html))) {
    contact_hints.push(hm[1]);
  }
  for (const form of forms) {
    for (const field of form.fields || []) {
      for (const val of [field.placeholder, field.name, field.id]) {
        if (val) contact_hints.push(val);
      }
    }
  }
  const uniqueHints = [...new Set(contact_hints.map((h) => h.trim()).filter(Boolean))].slice(0, 40);

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
    has_cookie_banner: detectCookieBanner(html, text_l, extraSource),
    uses_tracking_cookies: tracking.uses,
    tracking_hits: tracking.hits,
    contact_hints: uniqueHints,
    has_form_consent: detectFormConsent(html),
    has_accessibility: detectAccessibility(html, text_l, extraSource, legal_links),
    sensitive_form_suspected,
    text_length: text.length,
    visible_text: text,
  };
}
