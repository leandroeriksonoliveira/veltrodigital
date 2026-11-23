import type { AdminSection } from './AdminNav';

export const SECTION_META: Record<
  AdminSection,
  { tag: string; title: string; lead: string }
> = {
  home: {
    tag: 'Uso interno',
    title: 'Painel administrativo',
    lead: 'Escolha um relatório abaixo ou use o menu no topo.',
  },
  reports: {
    tag: 'Uso interno · leads',
    title: 'Leads e notas de conformidade',
    lead: 'Contato do lead + resumo numérico. Relatório detalhado não é gerado nem salvo online.',
  },
  consultations: {
    tag: 'Uso interno · analisador',
    title: 'Últimos sites consultados',
    lead: 'URLs analisadas no formulário público. Exportação Excel: slug, nome, site, instagram, conselho, observacao, prioridade.',
  },
};