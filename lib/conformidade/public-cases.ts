/** Casos públicos para o resultado. A tela usa a categoria, nunca o nome da empresa. */

export type PublicCase = {
  id: 'lgpd' | 'oferta' | 'etica';
  organ: string;
  year: string;
  who: string;
  amount: string | null;
  fact: string;
  sourceLabel: string;
  sourceUrl: string;
};

const CASO_MICRO_WHATSAPP: PublicCase = {
  id: 'lgpd',
  organ: 'ANPD',
  year: '2023',
  who: 'Microempresa',
  amount: 'R$ 14.400',
  fact: 'Duas multas de R$ 7.200. Lista de WhatsApp sem base legal. Também houve advertência.',
  sourceLabel: 'Decisão publicada pela ANPD',
  sourceUrl:
    'https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aplica-a-primeira-multa-por-descumprimento-a-lgpd',
};

const CASO_OFERTA_SITE: PublicCase = {
  id: 'oferta',
  organ: 'Procon-MPMG',
  year: '2025',
  who: 'Empresa de telefonia',
  amount: 'R$ 186.666,67',
  fact: 'O site omitiu a condição da oferta. A multa foi aplicada por publicidade enganosa.',
  sourceLabel: 'Decisão publicada pelo Procon-MPMG',
  sourceUrl:
    'https://www.mpmg.mp.br/portal/menu/comunicacao/noticias/procon-mpmg-multa-oi-por-publicidade-enganosa.shtml',
};

const CASO_DENTISTA: PublicCase = {
  id: 'etica',
  organ: 'Procon SC',
  year: '2024',
  who: 'Dentista',
  amount: null,
  fact: 'Processo com o CRM e o CRO por anúncio de resultado definitivo nas redes. Não há multa publicada.',
  sourceLabel: 'Comunicado do Procon SC',
  sourceUrl:
    'https://www.procon.sc.gov.br/procon-sc-investiga-dentista-que-vende-procedimento-estetico-sem-qualificacao/',
};

export function pickPublicCase(scores: {
  score_lgpd: number;
  score_marco_civil: number;
  score_etica_profissional: number;
}): PublicCase {
  const areas = [
    { id: 'lgpd' as const, score: scores.score_lgpd },
    { id: 'oferta' as const, score: scores.score_marco_civil },
    { id: 'etica' as const, score: scores.score_etica_profissional },
  ];
  const rank = { lgpd: 0, oferta: 1, etica: 2 };
  areas.sort((a, b) => a.score - b.score || rank[a.id] - rank[b.id]);

  for (const area of areas) {
    if (area.id === 'etica' && area.score < 85) return CASO_DENTISTA;
    if (area.id === 'oferta') return CASO_OFERTA_SITE;
    if (area.id === 'lgpd') return CASO_MICRO_WHATSAPP;
  }
  return CASO_MICRO_WHATSAPP;
}
