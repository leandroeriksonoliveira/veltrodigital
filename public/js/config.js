/**
 * Configuração central — edite aqui para alterar contatos e links.
 */
const SITE_CONFIG = {
  name: 'VeltroDigital',
  tagline: 'Transformação Digital para Profissionais',
  legalName: 'Veltro Digital',
  legalResponsible: 'Leandro Oliveira',
  cnpj: '68.542.453/0001-83',
  legalAddress: 'São Paulo, SP, Brasil',
  whatsappPhone: '5511986446779',
  whatsappDisplay: '(11) 98644-6779',
  email: 'contato@veltrodigital.com.br',
  dpoEmail: 'privacidade@veltrodigital.com.br',
  emails: {
    medicos: 'medicos@veltrodigital.com.br',
    advogados: 'advogados@veltrodigital.com.br',
    esporte: 'esporte@veltrodigital.com.br',
    arquitetura: 'arquitetura@veltrodigital.com.br',
  },
  // Instagram omitido enquanto o perfil @veltrodigital não tiver conteúdo público
  // (evita link para canal vazio). Reative quando houver posts.
  // instagram: 'https://instagram.com/veltrodigital',
  linkedin: 'https://linkedin.com/company/veltrodigital',
  siteUrl: 'https://www.veltrodigital.com.br',
};

function getWhatsAppUrl(message) {
  const lang = document.documentElement.lang || 'pt-BR';
  const defaultMsg = lang.startsWith('en')
    ? 'Hello! I would like to request a free consultation with Veltro Digital.'
    : 'Olá! Gostaria de solicitar uma consultoria gratuita com a Veltro Digital.';
  const text = message || defaultMsg;
  return `https://wa.me/${SITE_CONFIG.whatsappPhone}?text=${encodeURIComponent(text)}`;
}

const SITE_I18N = {
  'pt-BR': {
    footerRights: 'Todos os direitos reservados.',
    dpoLabel: 'Encarregado de dados (DPO):',
  },
  en: {
    footerRights: 'All rights reserved.',
    dpoLabel: 'Data Protection Officer (DPO):',
  },
};

function getSiteLocale() {
  const lang = (document.documentElement.lang || 'pt-BR').toLowerCase();
  return lang.startsWith('en') ? 'en' : 'pt-BR';
}
