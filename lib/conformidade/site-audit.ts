/**
 * Coleta remota leve de site institucional (sem browser).
 * Alinhado ao skill site-compliance-audit e ao script local Conformidade Digital.
 */

import { extractSiteSignals, type SiteSignals } from './site-signals';

export interface SiteEvidence {
  url: string;
  finalUrl: string;
  title: string;
  hasHttps: boolean;
  hasPrivacyPolicy: boolean;
  hasTerms: boolean;
  hasLgpdMention: boolean;
  hasConsentHint: boolean;
  hasCookieHint: boolean;
  hasProfessionalIdHint: boolean;
  textSample: string;
  summary: string;
  /** HTML bruto para o score local (não exposto ao cliente) */
  html: string;
  signals: SiteSignals;
}

async function fetchSameOriginScripts(html: string, pageUrl: string): Promise<string> {
  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
  let origin = '';
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return '';
  }
  const chunks: string[] = [];
  for (const src of srcs.slice(0, 6)) {
    let abs = '';
    try {
      abs = new URL(src, pageUrl).toString();
    } catch {
      continue;
    }
    if (!abs.startsWith(origin)) continue;
    try {
      const jsRes = await fetch(abs, {
        headers: { 'User-Agent': 'VeltroDigitalComplianceBot/1.0 (+https://www.veltrodigital.com.br)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!jsRes.ok) continue;
      chunks.push((await jsRes.text()).slice(0, 200_000));
    } catch {
      /* script opcional para detectar banner/acessibilidade injetados */
    }
  }
  return chunks.join('\n');
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchSiteEvidence(url: string): Promise<SiteEvidence> {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

  const res = await fetch(normalized, {
    headers: {
      'User-Agent': 'VeltroDigitalComplianceBot/1.0 (+https://www.veltrodigital.com.br)',
      Accept: 'text/html',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });

  const html = await res.text();
  const finalUrl = res.url || normalized;
  const extraSource = await fetchSameOriginScripts(html, finalUrl);
  const signals = extractSiteSignals(html, finalUrl, extraSource);

  // Páginas legais (privacidade, cookies, termos) — igual ao lote Playwright
  const legalFetched: { href: string; ok: boolean; text_len: number }[] = [];
  const seenLegal = new Set<string>();
  for (const link of (signals.legal_links || []).slice(0, 4)) {
    const href = (link.href || '').trim();
    if (!href || seenLegal.has(href)) continue;
    seenLegal.add(href);
    try {
      const pageRes = await fetch(href, {
        headers: {
          'User-Agent': 'VeltroDigitalComplianceBot/1.0 (+https://www.veltrodigital.com.br)',
          Accept: 'text/html',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
      });
      if (!pageRes.ok) {
        legalFetched.push({ href, ok: false, text_len: 0 });
        continue;
      }
      const pageHtml = await pageRes.text();
      const pageText = stripHtml(pageHtml).slice(0, 25000);
      if (pageText) {
        signals.visible_text = `${signals.visible_text || ''}\n${pageText}`.slice(0, 80000);
      }
      legalFetched.push({ href, ok: true, text_len: pageText.length });
    } catch {
      legalFetched.push({ href, ok: false, text_len: 0 });
    }
  }
  signals.legal_pages_fetched = legalFetched;

  const mergedLower = `${html}\n${signals.visible_text || ''}`.toLowerCase();
  const text = (signals.visible_text || '').slice(0, 20000) || stripHtml(html).slice(0, 12000);
  const title = signals.title;

  const hasPrivacyPolicy =
    signals.has_privacy_link || /pol[ií]tica\s+de\s+privacidade|privacy\s+policy/.test(mergedLower);
  const hasTerms = signals.has_terms_link || /termos\s+de\s+uso|termos\s+e\s+condi/.test(mergedLower);
  const hasLgpdMention = /lgpd|lei\s*(geral\s*)?de\s*prote[cç][aã]o\s*de\s*dados|13\.?709/.test(mergedLower);
  const hasConsentHint = /consentimento|aceito\s+a\s+pol[ií]tica|autorizo\s+o\s+tratamento/.test(mergedLower);
  const hasCookieHint = signals.has_cookie_hint || /cookie|cookies/.test(mergedLower);
  const hasProfessionalIdHint =
    signals.crm_matches.length > 0 ||
    signals.crp_matches.length > 0 ||
    signals.cro_matches.length > 0 ||
    /\bcrm[\s/-]*\d|\boab[\s/-]*\d|\bcrp[\s/-]*\d|\bcrefito|\bcro[\s/-]*\d|\bcrv|\bcoren|\bcrn|\bcau[\s/-]*\d|\bcrea[\s/-]*[a-z0-9]|\bcreci|\bcrmv|\bcrbm|\bcref(?!ito)[\s/-]*\d|\bcrc\s*[-/]\s*[a-z]{2}/i.test(
      text
    );

  // Atualiza flags a partir do texto enriquecido (ex.: DPO só na política)
  signals.has_privacy_link = signals.has_privacy_link || hasPrivacyPolicy;
  signals.has_terms_link = signals.has_terms_link || hasTerms;
  signals.has_cookie_hint = signals.has_cookie_hint || hasCookieHint;
  signals.text_length = (signals.visible_text || '').length;

  const evidence: SiteEvidence = {
    url: normalized,
    finalUrl,
    title,
    hasHttps: finalUrl.startsWith('https://') || signals.https,
    hasPrivacyPolicy,
    hasTerms,
    hasLgpdMention,
    hasConsentHint,
    hasCookieHint,
    hasProfessionalIdHint,
    textSample: text,
    summary: '',
    html,
    signals,
  };

  evidence.summary = [
    `URL final: ${evidence.finalUrl}`,
    `Título: ${evidence.title || 'n/d'}`,
    `HTTPS: ${evidence.hasHttps ? 'sim' : 'não'}`,
    `Política de Privacidade detectada: ${evidence.hasPrivacyPolicy ? 'sim' : 'não'}`,
    `Termos de Uso detectados: ${evidence.hasTerms ? 'sim' : 'não'}`,
    `Menção LGPD: ${evidence.hasLgpdMention ? 'sim' : 'não'}`,
    `Indício de consentimento em formulário: ${evidence.hasConsentHint ? 'sim' : 'não'}`,
    `Menção a cookies: ${evidence.hasCookieHint ? 'sim' : 'não'}`,
    `Indício de registro profissional (CRM/OAB/etc.): ${evidence.hasProfessionalIdHint ? 'sim' : 'não'}`,
    `Páginas legais lidas: ${legalFetched.filter((x) => x.ok).length}`,
    `Amostra de texto (home + legais): ${evidence.textSample.slice(0, 4000)}`,
  ].join('\n');

  return evidence;
}
