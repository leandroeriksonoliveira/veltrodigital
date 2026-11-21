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
  const lower = html.toLowerCase();
  const signals = extractSiteSignals(html, finalUrl);
  const text = signals.visible_text.slice(0, 12000) || stripHtml(html).slice(0, 12000);
  const title = signals.title;

  const hasPrivacyPolicy =
    signals.has_privacy_link || /pol[ií]tica\s+de\s+privacidade|privacy\s+policy/.test(lower);
  const hasTerms = signals.has_terms_link || /termos\s+de\s+uso|termos\s+e\s+condi/.test(lower);
  const hasLgpdMention = /lgpd|lei\s*(geral\s*)?de\s*prote[cç][aã]o\s*de\s*dados|13\.?709/.test(lower);
  const hasConsentHint = /consentimento|aceito\s+a\s+pol[ií]tica|autorizo\s+o\s+tratamento/.test(lower);
  const hasCookieHint = signals.has_cookie_hint || /cookie|cookies/.test(lower);
  const hasProfessionalIdHint =
    signals.crm_matches.length > 0 ||
    signals.crp_matches.length > 0 ||
    signals.cro_matches.length > 0 ||
    /\bcrm[\s/-]*\d|\boab[\s/-]*\d|\bcrp[\s/-]*\d|\bcrefito|\bcro[\s/-]*\d|\bcrv|\bcoren|\bcrn|\bcau[\s/-]*\d/i.test(
      text
    );

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
    `Amostra de texto (home): ${evidence.textSample.slice(0, 4000)}`,
  ].join('\n');

  return evidence;
}
