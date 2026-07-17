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

export type AuditStatus = 'conforme' | 'atencao' | 'nao_conforme' | 'critico' | 'na';

export type AuditSurface = 'rede_social' | 'site' | 'transversal';

/** Scoreboard no padrão skill site-compliance-audit / resumo numérico */
export interface Scoreboard {
  total_avaliados: number;
  conformes: number;
  atencao: number;
  nao_conformes: number;
  criticos: number;
  indice: number;
  infracoes_mapeadas: number;
  riscos_alta: number;
  riscos_media: number;
  riscos_reputacionais: number;
}

export interface ClientReport {
  score_geral: number;
  score_lgpd: number;
  score_marco_civil: number;
  score_etica_profissional: number;
  /** Notas separadas por superfície (quando houver coleta) */
  score_rede_social?: number | null;
  score_site?: number | null;
  selo: Selo;
  veredito: string;
  cta_generico: string;
  scoreboard: Scoreboard;
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

/** Item de checklist no padrão do relatório detalhado da skill */
export interface AuditItem {
  id: string;
  superficie: AuditSurface;
  secao: string;
  titulo: string;
  status: AuditStatus;
  evidencia: string;
  norma: string;
  acao: string;
  penalidade_possivel: string;
  risco: 'alto' | 'medio' | 'baixo' | 'na';
}

export interface PenaltyRow {
  esfera: string;
  consequencia: string;
  fundamentacao: string;
}

export interface ActionPlan {
  dias_7: string[];
  dias_15: string[];
  dias_30: string[];
}

export interface InternalReport {
  diagnostico_geral: string;
  veredito: string;
  scoreboard: Scoreboard;
  /** Itens de checklist — rede social e site separados por superficie */
  itens: AuditItem[];
  red_flags: RedFlag[];
  penalidades_estimadas: {
    esfera_etica_conselho: string;
    esfera_lgpd_anpd: string;
    esfera_civil_criminal: string;
  };
  penalidades_tabela: PenaltyRow[];
  plano_acao: ActionPlan;
  recomendacoes_correcao: string;
  resumo_para_time_comercial: string;
  /** Análise narrativa dedicada à rede social */
  analise_rede_social: string;
  /** Análise narrativa dedicada ao site (se houver) */
  analise_site: string;
}

export interface AiAnalysisPayload {
  profession: string;
  client_report: ClientReport;
  /** @deprecated Relatório detalhado não é mais gerado/salvo online */
  internal_report?: InternalReport;
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

export function vereditoFromScoreboard(sb: Scoreboard): string {
  if (sb.criticos >= 1 || sb.indice < 60) return 'Não Conforme';
  if (sb.indice >= 85) return 'Conforme';
  return 'Aprovado com Ressalvas';
}
