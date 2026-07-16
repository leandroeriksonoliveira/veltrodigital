export type Profession =
  | 'medico'
  | 'advogado'
  | 'fisioterapeuta'
  | 'psicologo'
  | 'dentista'
  | 'veterinario'
  | 'enfermeiro'
  | 'nutricionista'
  | 'arquiteto'
  | 'outro';

export type InputType = 'texto' | 'imagem' | 'site' | 'link_referencia' | 'misto';

export type Selo = 'Aprovado' | 'Risco Moderado' | 'Risco Crítico';

export type RiskCategory = 'LGPD' | 'Marco Civil' | 'Etica_Profissional';

export interface ClientReport {
  score_geral: number;
  score_lgpd: number;
  score_marco_civil: number;
  score_etica_profissional: number;
  selo: Selo;
  cta_generico: string;
  penalidades_resumo: {
    multa_anpd_max: string;
    multa_pf_referencia: string;
    suspensao_conselho: string;
    riscos_imagem: string;
    sanções_eticas: string;
  };
}

export interface RedFlag {
  trecho: string;
  categoria: RiskCategory;
  norma_violada: string;
  explicacao: string;
}

export interface InternalReport {
  diagnostico_geral: string;
  red_flags: RedFlag[];
  penalidades_estimadas: {
    esfera_etica_conselho: string;
    esfera_lgpd_anpd: string;
    esfera_civil_criminal: string;
  };
  recomendacoes_correcao: string;
  resumo_para_time_comercial: string;
}

export interface AiAnalysisPayload {
  profession: string;
  client_report: ClientReport;
  internal_report: InternalReport;
}

export const PROFESSION_LABELS: Record<Profession, string> = {
  medico: 'Médico(a)',
  advogado: 'Advogado(a)',
  fisioterapeuta: 'Fisioterapeuta',
  psicologo: 'Psicólogo(a)',
  dentista: 'Dentista',
  veterinario: 'Veterinário(a)',
  enfermeiro: 'Enfermeiro(a)',
  nutricionista: 'Nutricionista',
  arquiteto: 'Arquiteto(a) / Engenheiro(a)',
  outro: 'Outro profissional liberal',
};

export function seloFromScore(score: number): Selo {
  if (score >= 85) return 'Aprovado';
  if (score >= 60) return 'Risco Moderado';
  return 'Risco Crítico';
}
