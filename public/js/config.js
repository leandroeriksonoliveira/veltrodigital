/**
 * Configuração central — edite aqui para alterar contatos e links.
 */
const SITE_CONFIG = {
  name: 'VeltroDigital',
  tagline: 'Transformação Digital para Profissionais',
  legalName: 'Veltro Digital',
  legalResponsible: 'Leandro Oliveira',
  cnpj: '', // Preencher quando disponível — exibido automaticamente no rodapé
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
  instagram: 'https://instagram.com/veltrodigital',
  linkedin: 'https://linkedin.com/company/veltrodigital',
  siteUrl: 'https://www.veltrodigital.com.br',
};

function getWhatsAppUrl(message) {
  const text = message || 'Olá! Gostaria de solicitar uma consultoria gratuita com a Veltro Digital.';
  return `https://wa.me/${SITE_CONFIG.whatsappPhone}?text=${encodeURIComponent(text)}`;
}
