/**
 * Análise pública do /analisador — score local (sem OpenAI / sem HTML-PDF).
 */

import type { AiAnalysisPayload, Profession } from './types';
import {
  buildEvidenceFromAudits,
  scoreFromEvidence,
  toClientReport,
} from './local-score';
import type { SiteEvidence } from './site-audit';
import type { SocialEvidence } from './social-audit';

export function runLocalComplianceAnalysis(input: {
  name: string;
  profession: Profession | string;
  site?: SiteEvidence | null;
  social?: SocialEvidence | null;
}): AiAnalysisPayload {
  const hasSite = Boolean(input.site?.signals);
  const hasSocial = Boolean(input.social);

  if (!hasSite && !hasSocial) {
    throw new Error('Sem material coletado para pontuar.');
  }

  // Score local exige sinais de site; se só rede, montamos signals mínimos a partir do texto social
  let siteSignals = input.site?.signals;
  let siteUrl = input.site?.finalUrl || input.site?.url || '';
  if (!siteSignals && input.social) {
    const text = input.social.textSample || input.social.bio || input.social.description || '';
    siteSignals = {
      title: input.social.title || '',
      metas: {},
      legal_links: [],
      forms_count: 0,
      forms: [],
      crm_matches: [],
      crp_matches: [],
      rqe_matches: [],
      cro_matches: [],
      forbidden_hits: [],
      https: true,
      has_privacy_link: /privacidade|privacy/i.test(text),
      has_terms_link: /termos/i.test(text),
      has_cookie_hint: /cookie/i.test(text),
      sensitive_form_suspected: false,
      text_length: text.length,
      visible_text: text.slice(0, 20000),
    };
    siteUrl = input.social.finalUrl || input.social.url;
  }

  const evidence = buildEvidenceFromAudits({
    name: input.name,
    profession: input.profession,
    siteUrl,
    siteFinalUrl: input.site?.finalUrl || siteUrl,
    siteSignals,
    social: input.social,
  });

  const scored = scoreFromEvidence(evidence);
  const client_report = toClientReport(scored, {
    hasSocial,
    hasSite: Boolean(input.site),
  });

  return {
    profession: String(input.profession),
    client_report,
  };
}
