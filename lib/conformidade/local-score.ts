/**
 * Score determinístico (sem IA) — port de Conformidade Digital/score_rules.py
 * Retorna apenas client_report numérico para o /analisador.
 */

import checklistData from './data/checklist-index.json';
import type { ClientReport, Profession, Scoreboard } from './types';
import { seloFromScore, vereditoFromScoreboard } from './types';
import type { SiteSignals } from './site-signals';
import type { SocialEvidence } from './social-audit';

type ChecklistRaw = {
  title?: string;
  section?: string;
  laws?: string;
  desc?: string;
  prof?: string;
  _source_key?: string;
};

type ScoredItem = {
  id: string;
  section: string;
  channel: 'site' | 'instagram';
  title: string;
  laws: string;
  status: 'conforme' | 'atencao' | 'nao_conforme' | 'critico' | 'na';
  evidence: string;
  critical_candidate: boolean;
};

export type LocalEvidence = {
  lead: {
    nome: string;
    site: string;
    instagram?: string;
    conselho: string;
  };
  site?: {
    ok: boolean;
    final_url?: string;
    signals: SiteSignals;
  };
  instagram?: Record<string, unknown>;
  socials?: Record<string, Record<string, unknown>>;
  collection_complete_site: boolean;
};

const HEALTH_MARKERS = [
  'crm',
  'crp',
  'crefito',
  'cro',
  'rqe',
  'paciente',
  'telemed',
  'telepsic',
  'diretor técn',
  'diretor tecn',
  'anvisa',
  'coffito',
  'cfm',
  'cfp',
  'médic',
  'medic',
  'psicólog',
  'psicolog',
  'fisioterapeut',
  'odonto',
  'e-psi',
];

const EMPRESA_KEEP = [
  'privacidade',
  'cookie',
  'https',
  'ssl',
  'formul',
  'consent',
  'contato',
  'endereço',
  'endereco',
  'cnpj',
  'acessib',
  'encarregado',
  'dpo',
  'consumidor',
  'termos de uso',
];

const IG_CHROME = new Set([
  'entrar',
  'cadastre-se',
  'meta',
  'sobre',
  'blog',
  'carreiras',
  'ajuda',
  'api',
  'privacidade',
  'termos',
  'localizações',
  'localizacoes',
  'popular',
  'instagram lite',
  'meta ai',
  'muse',
  'threads',
  'meta verified',
]);

function loadChecklist(): ChecklistRaw[] {
  const data = checklistData as Record<string, ChecklistRaw[]>;
  const items: ChecklistRaw[] = [];
  for (const [key, arr] of Object.entries(data)) {
    if (!Array.isArray(arr)) continue;
    for (const it of arr) {
      items.push({ ...it, _source_key: key });
    }
  }
  return items;
}

function aliases(conselho: string): Set<string> {
  const c = (conselho || '').toLowerCase().trim();
  const groups: Record<string, string[]> = {
    medico: ['medico', 'medica', 'crm', 'clinica', 'saude'],
    psicologo: ['psicologo', 'psicologa', 'psi', 'crp'],
    fisio: ['fisio', 'fisioterapeuta', 'crefito'],
    dentista: ['dentista', 'cro'],
    enfermeiro: ['enfermeiro', 'coren'],
    nutricionista: ['nutricionista', 'crn'],
    advogado: ['advogado', 'oab'],
    empresa: ['empresa', 'saas', 'outro'],
  };
  if (!c) return new Set(['medico', 'psicologo', 'fisio', 'dentista', 'todos']);
  for (const [k, vals] of Object.entries(groups)) {
    if (vals.includes(c) || c === k) return new Set([...vals, k, 'todos']);
  }
  return new Set([c, 'todos']);
}

function profMatch(item: ChecklistRaw, conselho: string): boolean {
  const prof = (item.prof || 'todos').toLowerCase();
  if (['todos', 'all', ''].includes(prof)) return true;
  const allowed = aliases(conselho);
  return [...allowed].some((a) => prof.startsWith(a.slice(0, 4)) || a.startsWith(prof.slice(0, 4)));
}

function councilOnlyLaw(raw: ChecklistRaw): boolean {
  const laws = (raw.laws || '').toLowerCase();
  if (/lgpd|cdc|marco civil|anpd|procon/.test(laws)) return false;
  return /\boab\b|cfoab|\bcfm\b|\bcfp\b|cepp|coffito|crefito|\bcro\b|\bcfo\b|\bced\b|prov\.?\s*205|\bcem\b/.test(
    laws
  );
}

function itemApplies(raw: ChecklistRaw, area: string): boolean {
  if (area !== 'empresa') return profMatch(raw, area);
  if (councilOnlyLaw(raw)) return false;
  const blob = `${raw.title || ''} ${raw.section || ''}`.toLowerCase();
  if (HEALTH_MARKERS.some((k) => blob.includes(k))) return false;
  return EMPRESA_KEEP.some((k) => blob.includes(k));
}

function detectArea(conselho: string, siteText: string): string {
  const c = (conselho || '').toLowerCase().trim();
  for (const key of ['medico', 'psicologo', 'fisio', 'dentista', 'advogado'] as const) {
    if (c && (aliases(key).has(c) || c === key)) return key;
  }
  // Empresa explícita na planilha/API. "outro" e vazio não entram aqui:
  // no analisador público significam "área desconhecida" e caem na leitura do site.
  if (['empresa', 'saas', 'commerce', 'ecommerce', 'agencia', 'agência'].includes(c)) {
    return 'empresa';
  }
  const t = siteText.toLowerCase();
  // Mesma regra do script do Mac: exige registro do conselho no texto.
  // Só a palavra da profissão (ex.: "médicos" num site B2B) não muda a área.
  // "OAB 205" é o Provimento, comum em site institucional, e não conta como inscrição.
  if (/\bcrm\s*\/?\s*[a-z]{2}\b|\bcrm\s*\d{4,}/.test(t)) return 'medico';
  // O script do Mac pega CRP 123456 e CRP/SP. O coletor do site também acha CRP 06/123456.
  if (/\bcrp[-\s]?\d{3,}|\bcrp\s*\/?\s*[a-z]{2}\b|\bcrp[-\s]?\d{1,2}\s*\/\s*\d{2,7}/.test(t)) return 'psicologo';
  if (/\bcrefito\s*[-\s]?\d|\bcrefito\s*\/?\s*[a-z]{2}\b/.test(t)) return 'fisio';
  if (/\bcro\s*\/?\s*[a-z]{2}\b|\bcro\s*\d{3,}/.test(t)) return 'dentista';
  if (/\boab\s*\/\s*[a-z]{2}\b|\boab\s+[a-z]{2}\s*\d/.test(t)) return 'advogado';
  return 'empresa';
}

function domainOf(url: string): string {
  const host = (url || '').replace(/^https?:\/\//, '').split('/')[0];
  return host || 'o site';
}

function dataFormLabels(site: SiteSignals): string[] {
  const found: string[] = [];
  for (const form of site.forms || []) {
    const bits = (form.fields || []).flatMap((f) => [f.placeholder || '', f.name || '', f.type || '']);
    const label = bits.filter(Boolean).join(' ');
    if (/e-?mail|nome|telefone|whats|mensagem/i.test(label)) {
      const placeholders = (form.fields || []).map((f) => f.placeholder).filter(Boolean) as string[];
      found.push(placeholders.join(', ') || 'nome e e-mail');
    }
  }
  return found;
}

function corpus(evidence: LocalEvidence): string {
  const site = evidence.site?.signals;
  const ig = evidence.instagram || {};
  const socialBits: string[] = [];
  for (const [name, item] of Object.entries(evidence.socials || {})) {
    if (name === 'instagram' || !item) continue;
    socialBits.push(String(item.visible_text || ''));
    socialBits.push(String(item.title || ''));
    socialBits.push(...((item.visible_lines_sample as string[]) || []));
  }
  const og = (ig.og as Record<string, string>) || {};
  return [
    site?.visible_text || '',
    ...(site?.crm_matches || []),
    ...(site?.crp_matches || []),
    ...(site?.rqe_matches || []),
    String(ig.bio || ''),
    String(ig.full_name || ''),
    ...((ig.posts_sample as string[]) || []),
    og['og:description'] || '',
    og['og:title'] || '',
    ...((ig.visible_lines_sample as string[]) || []),
    ...socialBits,
  ]
    .join('\n')
    .toLowerCase();
}

function instagramItems(evidence: LocalEvidence, domain: string): ScoredItem[] {
  const ig = evidence.instagram || {};
  const socials = evidence.socials || {};
  const igSocial = (socials.instagram || {}) as Record<string, unknown>;
  const url = String(ig.url || igSocial.url || '');
  if (!url || ig.skipped) return [];
  const handle = url.replace(/\/$/, '').split('/').pop() || 'instagram';
  const where = `No Instagram @${handle}`;
  const bio = String(ig.bio || '').replace(/\?\?/g, '').replace(/^\s*\|\s*|\s*\|\s*$/g, '');
  const name = String(ig.full_name || '').trim();
  const lines: string[] = [];
  for (const line of (ig.visible_lines_sample as string[]) || []) {
    const low = line.trim().toLowerCase();
    if (!low || IG_CHROME.has(low) || low.startsWith('mostrar mais')) continue;
    if (low.includes('seguidor') || low === 'cadastre-se' || low === handle.toLowerCase()) continue;
    lines.push(line.trim());
  }
  const linkLine = lines.find((ln) => ln.includes('http') || ln.includes('.com') || ln.toLowerCase().includes('spotify')) || '';
  const highlights = lines.filter((ln) => ln.startsWith('//') || ln.startsWith('#'));
  const bioLines = lines.filter((ln) => ln.includes('|'));
  const bioQuote = bioLines.slice(0, 3).join(' · ') || bio || 'bio não lida';

  const row = (
    title: string,
    status: ScoredItem['status'],
    evidenceNote: string,
    laws: string
  ): ScoredItem => ({
    id: `instagram-${title.toLowerCase().replace(/\W+/g, '-').slice(0, 40)}`,
    section: 'instagram',
    channel: 'instagram',
    title,
    laws,
    status,
    evidence: evidenceNote,
    critical_candidate: false,
  });

  const items: ScoredItem[] = [
    row(
      'Identificação do perfil',
      name && handle ? 'conforme' : 'nao_conforme',
      `Perfil ${name || 'sem nome'} (@${handle}) em ${url}.`,
      'CDC · identificação de quem publica'
    ),
    row(
      'Bio descreve a atividade',
      bioQuote.length > 12 ? 'conforme' : 'atencao',
      `Bio de @${handle}: ${bioQuote.slice(0, 220)}`,
      'CDC · informação ao público'
    ),
  ];

  if (linkLine) {
    const pointsSite = domain && domain.replace(/^www\./, '') && linkLine.toLowerCase().includes(domain.replace(/^www\./, ''));
    const pointsPolicy = /privacidade|politica|política/.test(linkLine.toLowerCase());
    items.push(
      row(
        'Link na bio',
        pointsSite || pointsPolicy ? 'conforme' : 'atencao',
        `O link visível de @${handle} aponta para ${linkLine.slice(0, 180)}.`,
        'LGPD · transparência'
      )
    );
  } else {
    items.push(
      row(
        'Link na bio',
        'nao_conforme',
        `@${handle} não mostra link para o site nem para uma política.`,
        'LGPD Art. 9º'
      )
    );
  }

  items.push(
    row(
      'Destaques e posts públicos',
      'atencao',
      highlights.length
        ? `Destaques visíveis em @${handle}: ${highlights.slice(0, 6).join(', ')}.`
        : `O perfil @${handle} foi aberto, sem destaques nomeados e sem legendas de post.`,
      'CDC · publicidade'
    )
  );

  const privacyInBio = /privacidade|política|politica/.test(bio.toLowerCase());
  items.push(
    row(
      'Transparência de dados no Instagram',
      privacyInBio ? 'conforme' : 'nao_conforme',
      privacyInBio
        ? `A bio de @${handle} aponta a política.`
        : `A bio de @${handle} (${bioQuote.slice(0, 140)}) não leva a uma política de privacidade.`,
      'LGPD Art. 9º · ANPD'
    )
  );

  return items;
}

function scoreSubset(items: ScoredItem[], pred: (i: ScoredItem) => boolean): number {
  const filtered = items.filter((i) => i.status !== 'na' && pred(i));
  if (!filtered.length) return 0;
  const ok = filtered.filter((i) => i.status === 'conforme').length;
  return Math.round((100 * ok) / filtered.length);
}

export function scoreFromEvidence(evidence: LocalEvidence): {
  index_pct: number;
  verdict: string;
  counts: Scoreboard;
  items: ScoredItem[];
  area: string;
} {
  const lead = evidence.lead;
  const conselho = lead.conselho || '';
  const site = evidence.site?.signals;
  const emptySignals: SiteSignals = {
    title: '',
    metas: {},
    legal_links: [],
    forms_count: 0,
    forms: [],
    crm_matches: [],
    crp_matches: [],
    rqe_matches: [],
    cro_matches: [],
    forbidden_hits: [],
    https: false,
    has_privacy_link: false,
    has_terms_link: false,
    has_cookie_hint: false,
    has_cookie_banner: false,
    uses_tracking_cookies: false,
    tracking_hits: [],
    contact_hints: [],
    has_form_consent: false,
    has_accessibility: false,
    sensitive_form_suspected: false,
    text_length: 0,
    visible_text: '',
  };
  const signals = site || emptySignals;
  const siteText = [
    signals.visible_text || '',
    signals.title || '',
    ...(signals.crm_matches || []),
    ...(signals.crp_matches || []),
    ...(signals.cro_matches || []),
  ].join('\n');
  const domain = domainOf(lead.site || evidence.site?.final_url || '');
  const area = detectArea(conselho, siteText);
  // Sem conselho informado, as regras de "não aplicável" usam a área lida no site.
  const ruleConselho = conselho || (area === 'empresa' ? '' : area);
  const text = corpus(evidence);
  const hits = new Set(signals.forbidden_hits || []);

  const ig = evidence.instagram || {};
  const otherSocial: string[] = [];
  for (const [name, item] of Object.entries(evidence.socials || {})) {
    if (name === 'instagram' || !item) continue;
    otherSocial.push(String(item.visible_text || ''));
    otherSocial.push(String(item.title || ''));
  }
  const igText = [
    String(ig.bio || ''),
    ...((ig.posts_sample as string[]) || []),
    String(((ig.og as Record<string, string>) || {})['og:description'] || ''),
    ...otherSocial,
  ]
    .join(' ')
    .toLowerCase();
  if (/antes\s*e\s*depois|antes\/depois/.test(igText)) hits.add('antes_depois');
  if (/depoimento|estrelas|avalia[cç][aã]o/.test(igText)) hits.add('depoimento_estrelas');
  if (/resultado garantido|cura garantida|100%\s*eficaz/.test(igText)) hits.add('promessa');

  const itemsOut: ScoredItem[] = [];
  const counts = { conforme: 0, atencao: 0, nao_conforme: 0, critico: 0, na: 0 };

  for (const [idx, raw] of loadChecklist().entries()) {
    if (!itemApplies(raw, area)) continue;
    const title = raw.title || `item-${idx}`;
    const section = raw.section || '';
    const laws = raw.laws || '';
    const desc = (raw.desc || '').toLowerCase();
    const titleL = title.toLowerCase();
    const critical = title.includes('🔴') || laws.toLowerCase().includes('proibido');

    let status: ScoredItem['status'] = 'conforme';
    let evidenceNote = 'Sem indício contrário no material coletado.';

    if (titleL.includes('crm') && (titleL.includes('médico') || titleL.includes('medico') || titleL.includes('uf'))) {
      if (signals.crm_matches.length || /crm\s*\/?\s*[a-z]{2}\s*\d+/.test(text)) {
        status = 'conforme';
        evidenceNote = `CRM detectado: ${(signals.crm_matches.slice(0, 3).join(', ') || 'no texto')}`;
      } else {
        status = 'nao_conforme';
        evidenceNote = 'CRM/UF não encontrado no site/bio coletados.';
      }
    } else if (titleL.includes('crp')) {
      if (ruleConselho && !aliases('psicologo').has(ruleConselho)) status = 'na';
      else if (signals.crp_matches.length || /crp[-\s]?\d+/.test(text)) {
        status = 'conforme';
        evidenceNote = 'CRP detectado.';
      } else {
        status = 'nao_conforme';
        evidenceNote = 'CRP não encontrado no material coletado.';
      }
    } else if (titleL.includes('crefito')) {
      if (ruleConselho && !aliases('fisio').has(ruleConselho)) status = 'na';
      else if (text.includes('crefito')) {
        status = 'conforme';
        evidenceNote = 'CREFITO mencionado.';
      } else {
        status = 'nao_conforme';
        evidenceNote = 'CREFITO não encontrado.';
      }
    } else if (titleL.includes('cro') && !titleL.includes('crm')) {
      if (ruleConselho && !aliases('dentista').has(ruleConselho)) status = 'na';
      else if (signals.cro_matches.length || /\bcro\s*\/?\s*[a-z]{2}/.test(text)) {
        status = 'conforme';
        evidenceNote = 'CRO detectado.';
      } else {
        status = 'nao_conforme';
        evidenceNote = 'CRO não encontrado.';
      }
    } else if (titleL.includes('rqe') || (titleL.includes('especialidade') && titleL.includes('reconhec'))) {
      if (signals.rqe_matches.length || text.includes('rqe')) {
        status = 'conforme';
        evidenceNote = 'RQE/especialidade mencionado.';
      } else {
        status = 'atencao';
        evidenceNote = 'Especialidade/RQE não confirmados.';
      }
    } else if (titleL.includes('nome completo')) {
      const nome = (lead.nome || '').toLowerCase();
      const tokens = nome.split(/\s+/).filter((t) => t.length > 2).slice(0, 2);
      if (tokens.length && tokens.every((t) => text.includes(t))) {
        status = 'conforme';
        evidenceNote = 'Nome do profissional aparece no material.';
      } else {
        status = 'atencao';
        evidenceNote = 'Confirmar nome completo visível.';
      }
    } else if (titleL.includes('antes') && titleL.includes('depois')) {
      if (hits.has('antes_depois')) {
        status = critical ? 'critico' : 'nao_conforme';
        evidenceNote = "Padrão 'antes e depois' detectado.";
      } else {
        status = 'conforme';
        evidenceNote = 'Sem padrão textual de antes/depois.';
      }
    } else if (titleL.includes('depoimento') || titleL.includes('avaliações') || titleL.includes('avaliacoes')) {
      if (hits.has('depoimento_estrelas')) {
        status = critical ? 'critico' : 'nao_conforme';
        evidenceNote = 'Sinais de depoimento/avaliação.';
      } else {
        status = 'conforme';
        evidenceNote = 'Sem depoimento textual óbvio.';
      }
    } else if (
      titleL.includes('promess') ||
      titleL.includes('sensacional') ||
      (titleL.includes('resultado') && `${desc}${titleL}`.includes('garant'))
    ) {
      if (hits.has('promessa') || hits.has('melhor_medico')) {
        status = critical ? 'critico' : 'nao_conforme';
        evidenceNote = 'Linguagem de promessa/sensacionalismo detectada.';
      } else {
        status = 'conforme';
        evidenceNote = 'Sem padrões graves de promessa.';
      }
    } else if (
      titleL.includes('preço') ||
      titleL.includes('preco') ||
      titleL.includes('tabelas') ||
      titleL.includes('condições comerciais')
    ) {
      status = hits.has('preco') ? 'nao_conforme' : 'conforme';
      evidenceNote = hits.has('preco') ? 'Indício de preço/tabela no material.' : 'Sem indício claro de preço público.';
    } else if (titleL.includes('contagem de pacientes') || titleL.includes('número de pacientes') || titleL.includes('numero de pacientes')) {
      status = hits.has('contagem_pacientes') ? 'nao_conforme' : 'conforme';
      evidenceNote = hits.has('contagem_pacientes') ? 'Contagem de pacientes detectada.' : 'Sem contagem de pacientes.';
    } else if (
      (titleL.includes('privacidade') || titleL.includes('política de privacidade') || titleL.includes('politica de privacidade')) &&
      !titleL.includes('formul') &&
      !titleL.includes('consent')
    ) {
      const siteL = siteText.toLowerCase();
      if (signals.has_privacy_link) {
        status = 'conforme';
        evidenceNote = `O site ${domain} tem link de política de privacidade.`;
      } else if (siteL.includes('política de privacidade') || siteL.includes('politica de privacidade')) {
        status = 'atencao';
        evidenceNote = `Texto de política em ${domain}, sem página confirmada.`;
      } else {
        status = 'nao_conforme';
        evidenceNote = `Não há política de privacidade em ${domain}.`;
      }
    } else if (
      titleL.includes('termos de uso') ||
      (titleL.includes('termo') && titleL.includes('uso') && !titleL.includes('técnic') && !titleL.includes('tecnic'))
    ) {
      if (signals.has_terms_link || siteText.toLowerCase().includes('termos de uso')) {
        status = 'conforme';
        evidenceNote = `O site ${domain} referencia termos de uso.`;
      } else {
        status = 'atencao';
        evidenceNote = `O site ${domain} não mostra termos de uso.`;
      }
    } else if (titleL.includes('cookie')) {
      const usesTrackers = Boolean(signals.uses_tracking_cookies);
      const hits = signals.tracking_hits || [];
      const hitNote = hits.length ? ` Indícios: ${hits.slice(0, 4).join(', ')}.` : '';
      if (signals.has_cookie_banner) {
        status = 'conforme';
        evidenceNote = `Banner de cookies com aceitar/recusar detectado em ${domain}.`;
      } else if (usesTrackers) {
        status = 'nao_conforme';
        evidenceNote = `Há rastreador/cookie não essencial em ${domain}, sem banner com aceitar/recusar.${hitNote}`;
      } else {
        status = 'conforme';
        evidenceNote = `Sem indício de cookies não essenciais em ${domain}; banner não exigido nesta coleta.`;
      }
    } else if (titleL.includes('https') || titleL.includes('ssl') || titleL.includes('conexão segura') || titleL.includes('conexao segura')) {
      const finalUrl = evidence.site?.final_url || lead.site || '';
      const httpsOk = Boolean(signals.https) || String(finalUrl).toLowerCase().startsWith('https://');
      status = httpsOk ? 'conforme' : 'critico';
      evidenceNote = httpsOk ? 'HTTPS ativo.' : 'Sem HTTPS.';
    } else if (
      titleL.includes('dado') &&
      (titleL.includes('saúde') || titleL.includes('saude') || titleL.includes('sensív') || titleL.includes('sensiv'))
    ) {
      status = signals.sensitive_form_suspected ? 'critico' : 'atencao';
      evidenceNote = signals.sensitive_form_suspected
        ? 'Formulário com indício de dados sensíveis de saúde.'
        : 'Revisar formulários quanto a dados sensíveis.';
    } else if (titleL.includes('cnpj')) {
      const match = siteText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      if (match) {
        status = 'conforme';
        evidenceNote = `CNPJ ${match[0]} aparece em ${domain}.`;
      } else {
        status = 'nao_conforme';
        evidenceNote = `O site ${domain} não exibe CNPJ.`;
      }
    } else if (
      (titleL.includes('contato') || titleL.includes('endereço') || titleL.includes('endereco')) &&
      !titleL.includes('formul') &&
      !titleL.includes('consent') &&
      !titleL.includes('cnpj')
    ) {
      const formBits = (signals.forms || [])
        .flatMap((form) => form.fields || [])
        .flatMap((f) => [f.placeholder || '', f.name || '', f.id || ''])
        .join(' ');
      const contactBlob = `${siteText} ${formBits} ${(signals.contact_hints || []).join(' ')}`;
      const phone = contactBlob.match(/\(?\d{2}\)?\s*\d{4,5}-?\d{4}/) || contactBlob.match(/wa\.me\/55(\d{10,13})/i);
      const email = contactBlob.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
      if (phone && email) {
        status = 'conforme';
        evidenceNote = `Contato em ${domain}: ${phone[0]} e ${email[0]}.`;
      } else if (phone || email) {
        status = 'atencao';
        evidenceNote = `Contato parcial em ${domain}: falta ${phone ? 'e-mail' : 'telefone'} visível.`;
      } else {
        status = 'nao_conforme';
        evidenceNote = `O site ${domain} não reúne telefone e e-mail visíveis.`;
      }
    } else if (titleL.includes('consentimento') || titleL.includes('formulário') || titleL.includes('formulario')) {
      const dataForms = dataFormLabels(signals);
      if (!dataForms.length) {
        status = 'conforme';
        evidenceNote = `A home de ${domain} não tem formulário de coleta de dados.`;
      } else if (signals.has_form_consent) {
        status = 'conforme';
        evidenceNote = `O formulário de ${domain} tem checkbox de consentimento e referência à política/LGPD.`;
      } else if (signals.sensitive_form_suspected) {
        status = 'nao_conforme';
        evidenceNote = `O formulário de ${domain} pede ${dataForms[0]} e trata dado sensível sem aceite visível.`;
      } else {
        status = 'nao_conforme';
        evidenceNote = `O formulário de ${domain} pede ${dataForms[0]}, sem aceite nem link da política.`;
      }
    } else if (titleL.includes('instagram') || titleL.includes('rede social') || ['redes', 'instagram'].includes(section)) {
      const socials = evidence.socials || {};
      const found = Object.entries(socials)
        .filter(([, item]) => item && item.url)
        .map(([name, item]) => `${name} ${item.url}`);
      if (!lead.instagram && !found.length) {
        status = 'na';
        evidenceNote = 'Nenhuma rede encontrada.';
      } else if (ig.ready_for_full_audit) {
        status = 'conforme';
        evidenceNote = 'Perfil IG coletado. ' + found.join('; ');
      } else if (found.length || lead.instagram) {
        status = 'atencao';
        evidenceNote = 'Redes localizadas, com coleta limitada.';
      } else {
        status = 'atencao';
        evidenceNote = 'IG não coletado por completo.';
      }
    } else if (titleL.includes('telemed') || titleL.includes('telepsic')) {
      if (/telemed|online|vídeo|video/.test(text)) {
        status = 'atencao';
        evidenceNote = 'Oferta online/tele detectada.';
      } else {
        status = 'na';
        evidenceNote = 'Sem indício de teleatendimento.';
      }
    } else if (titleL.includes('acessib') || titleL.includes('accessib')) {
      if (signals.has_accessibility) {
        status = 'conforme';
        evidenceNote = `Recursos de acessibilidade detectados em ${domain}.`;
      } else {
        status = 'atencao';
        evidenceNote = 'Sem skip-link, ferramenta ou página de acessibilidade.';
      }
    } else if (titleL.includes('encarregado') || titleL.includes('(dpo)') || titleL.endsWith('dpo')) {
      // Local usual = política de privacidade (home é diferencial, não exigência).
      const siteL = siteText.toLowerCase();
      const dpoNamed =
        siteL.includes('encarregado') ||
        /\bdpo\b/.test(siteL) ||
        siteL.includes('responsável pela proteção de dados') ||
        siteL.includes('responsavel pela protecao de dados') ||
        siteL.includes('responsável pelo tratamento de dados') ||
        siteL.includes('responsavel pelo tratamento de dados') ||
        /(?:privacidade|lgpd|encarregado|dpo|dados)@[a-z0-9._%+-]+\.[a-z]{2,}/i.test(siteL);
      const privacyContext =
        Boolean(signals.has_privacy_link) ||
        siteL.includes('política de privacidade') ||
        siteL.includes('politica de privacidade') ||
        Boolean(signals.legal_pages_fetched?.length);
      if (dpoNamed) {
        status = 'conforme';
        evidenceNote = `Canal do encarregado/DPO identificado no material de ${domain} (política de privacidade e/ou páginas legais — local usual).`;
      } else if (
        privacyContext &&
        (siteL.includes('dados pessoais') || siteL.includes('titular')) &&
        (siteL.includes('@') || siteL.includes('e-mail') || siteL.includes('email'))
      ) {
        status = 'atencao';
        evidenceNote = `Há política/contato em ${domain}, mas o encarregado (DPO) não está nomeado de forma explícita. O canal costuma ficar na política — completar com identificação e e-mail (Art. 41).`;
      } else {
        status = 'nao_conforme';
        evidenceNote = `Encarregado (DPO) não identificado na política de privacidade nem nas páginas legais de ${domain}.`;
      }
    } else if (critical) {
      status = 'conforme';
      evidenceNote = 'Sem indício textual da conduta proibida.';
    } else {
      // Sem regra automática: não derruba a nota
      status = 'na';
      evidenceNote = 'Sem regra automática neste pré-score; revisar no relatório detalhado se aplicável.';
    }

    if (status !== 'na') counts[status] += 1;
    else counts.na += 1;

    itemsOut.push({
      id: `${section}-${idx}`,
      section,
      channel: 'site',
      title: title.replace(/🔴/g, '').trim(),
      laws,
      status,
      evidence: evidenceNote,
      critical_candidate: critical,
    });
  }

  for (const extra of instagramItems(evidence, domain)) {
    itemsOut.push(extra);
    if (extra.status !== 'na') counts[extra.status] += 1;
    else counts.na += 1;
  }

  const evaluated = itemsOut.filter((i) => i.status !== 'na');
  const ok = evaluated.filter((i) => i.status === 'conforme').length;
  const total = evaluated.length || 1;
  const pct = Math.round((100 * ok) / total);
  const crit = counts.critico;
  const fail = counts.nao_conforme;
  const warn = counts.atencao;

  let verdict = 'Aprovado com ressalvas';
  if (crit >= 1 || pct < 60) verdict = 'Não conforme';
  else if (pct >= 85 && crit === 0) verdict = 'Conforme';

  const scoreboard: Scoreboard = {
    total_avaliados: evaluated.length,
    conformes: ok,
    atencao: warn,
    nao_conformes: fail,
    criticos: crit,
    indice: pct,
    infracoes_mapeadas: fail + crit,
    riscos_alta: crit,
    riscos_media: warn,
    riscos_reputacionais: hits.has('depoimento_estrelas') || hits.has('antes_depois') ? 1 : 0,
  };

  return { index_pct: pct, verdict, counts: scoreboard, items: evaluated, area };
}

export function professionToConselho(profession: Profession | string): string {
  const key = (profession || '').toLowerCase().trim();
  // Vazio e "outro" = área ainda não conhecida. O score lê o site.
  // No script do Mac, a coluna vazia faz o mesmo; "outro" lá é override explícito.
  if (!key || key === 'outro') return '';
  const map: Record<string, string> = {
    medico: 'medico',
    fisioterapeuta: 'fisio',
    psicologo: 'psicologo',
    dentista: 'dentista',
    enfermeiro: 'enfermeiro',
    nutricionista: 'nutricionista',
    advogado: 'advogado',
    veterinario: 'empresa',
    arquiteto: 'empresa',
    empresa: 'empresa',
    saas: 'empresa',
  };
  return key in map ? map[key] : '';
}

export function areaToProfession(area: string): Profession {
  switch (area) {
    case 'medico':
      return 'medico';
    case 'psicologo':
      return 'psicologo';
    case 'fisio':
      return 'fisioterapeuta';
    case 'dentista':
      return 'dentista';
    case 'advogado':
      return 'advogado';
    case 'enfermeiro':
      return 'enfermeiro';
    case 'nutricionista':
      return 'nutricionista';
    default:
      return 'empresa';
  }
}

export function toClientReport(
  scored: ReturnType<typeof scoreFromEvidence>,
  opts: { hasSocial: boolean; hasSite: boolean }
): ClientReport {
  const { counts: sb, items, index_pct, area } = scored;
  const councilArea = area !== 'empresa';
  let selo = seloFromScore(index_pct);
  if (sb.criticos >= 1 || index_pct < 60) selo = 'Risco Crítico';
  else if (index_pct >= 85) selo = 'Aprovado';
  else selo = 'Risco Moderado';

  const veredito = vereditoFromScoreboard(sb);

  const score_lgpd = scoreSubset(items, (i) => /lgpd|anpd|privacidade|cookie|consent|dado/.test(`${i.laws} ${i.title}`.toLowerCase())) || index_pct;
  const score_marco_civil =
    scoreSubset(items, (i) => /marco civil|cdc|procon|consumidor/.test(`${i.laws} ${i.title}`.toLowerCase())) || index_pct;
  const score_etica =
    scoreSubset(items, (i) => /cfm|oab|cfp|cro|crefito|coffito|ético|etica|crm|crp/.test(`${i.laws} ${i.title}`.toLowerCase())) ||
    index_pct;

  const score_rede = opts.hasSocial ? scoreSubset(items, (i) => i.channel === 'instagram' || i.section === 'instagram') || null : null;
  const score_site = opts.hasSite ? scoreSubset(items, (i) => i.channel === 'site') || index_pct : null;

  const cta =
    selo === 'Aprovado'
      ? 'Seu perfil digital apresenta boa aderência inicial. A Veltro Digital pode aprofundar o diagnóstico completo.'
      : 'Identificamos pontos de atenção no seu perfil digital. Fale com um especialista da Veltro Digital.';

  return {
    score_geral: index_pct,
    score_lgpd,
    score_marco_civil,
    score_etica_profissional: score_etica,
    score_rede_social: score_rede,
    score_site,
    selo,
    veredito,
    cta_generico: cta,
    scoreboard: sb,
    penalidades_resumo: {
      multa_anpd_max: 'Até 2% do faturamento, teto R$ 50.000.000 por infração (LGPD Art. 52)',
      multa_pf_referencia: 'Referência PF grave: até ~R$ 12.000 (dosimetria ANPD)',
      suspensao_conselho: councilArea
        ? 'Suspensão ética/disciplinar conforme conselho de classe'
        : '',
      riscos_imagem: 'Publicização da infração e dano reputacional',
      sanções_eticas: councilArea
        ? 'Advertência, censura, suspensão ou cassação/exclusão'
        : '',
    },
  };
}

export function buildEvidenceFromAudits(input: {
  name: string;
  profession: Profession | string;
  siteUrl?: string;
  siteHtml?: string;
  siteFinalUrl?: string;
  siteSignals?: SiteSignals;
  social?: SocialEvidence | null;
}): LocalEvidence {
  const conselho = professionToConselho(input.profession);
  const social = input.social;
  const socials: Record<string, Record<string, unknown>> = {};
  let instagram: Record<string, unknown> | undefined;

  if (social) {
    const pack = {
      url: social.finalUrl || social.url,
      source: 'analisador',
      title: social.title,
      bio: social.bio || social.description,
      full_name: social.title,
      visible_text: social.textSample,
      visible_lines_sample: social.textSample.split(/\s{2,}|\n/).map((s) => s.trim()).filter(Boolean).slice(0, 30),
      posts_sample: [] as string[],
      og: {
        'og:title': social.title,
        'og:description': social.description || social.bio,
      },
      collection_level: social.collectionQuality,
      ready_for_full_audit: social.collectionQuality === 'full' || social.collectionQuality === 'partial',
    };
    if (social.platform === 'instagram') {
      instagram = pack;
      socials.instagram = pack;
    } else {
      socials[social.platform || 'outro'] = pack;
    }
  }

  const hasSite = Boolean(input.siteSignals && input.siteUrl);
  return {
    lead: {
      nome: input.name,
      site: input.siteUrl || '',
      instagram: social?.platform === 'instagram' ? social.url : undefined,
      conselho,
    },
    site: hasSite
      ? {
          ok: true,
          final_url: input.siteFinalUrl || input.siteUrl,
          signals: input.siteSignals!,
        }
      : undefined,
    instagram,
    socials,
    collection_complete_site: hasSite,
  };
}
