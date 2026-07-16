/**
 * Checklist condensado alinhado à skill site-compliance-audit
 * (itens típicos de site + rede social para profissionais liberais).
 */

export const CHECKLIST_REDE_SOCIAL = `
## CHECKLIST OBRIGATÓRIO — REDE SOCIAL (Instagram / LinkedIn / Facebook / similares)
Avaliar CADA item com status: conforme | atencao | nao_conforme | critico | na.
Superfície = "rede_social". Incluir evidência literal da bio/legendas quando falhar.

### Identificação profissional
- RS-ID-01 Nome completo / razão social visível no perfil
- RS-ID-02 Registro do conselho na bio ou nome (CRM/OAB/CRO/CRP/etc. + UF)
- RS-ID-03 Qualificação profissional clara (ex.: Médico, Advogado, Dentista)
- RS-ID-04 Especialidade só se permitida/registrada (RQE etc.)

### Conteúdo vedado / publicidade
- RS-PRO-01 Depoimentos, estrelas ou avaliações de pacientes/clientes
- RS-PRO-02 Antes/depois ou fotos comparativas indevidas
- RS-PRO-03 Preços, pacotes, "a partir de" ou parcelamento
- RS-PRO-04 Promessa de resultado / garantia de êxito
- RS-PRO-05 Sensacionalismo, superlativos ou urgência comercial
- RS-PRO-06 Contagem de pacientes/clientes/casos como marketing
- RS-PRO-07 Captação indevida / consulta gratuita como isca (advocacia/saúde)
- RS-PRO-08 Menção nominal a clientes/pacientes sem base ética

### Linguagem e posts recentes
- RS-LIN-01 Tom sóbrio e informativo nas legendas amostradas
- RS-LIN-02 Ausência de conteúdo enganoso (CDC)
- RS-LIN-03 Stories/reels descritos nas legendas sem violar proibições

### LGPD / dados na rede
- RS-LGPD-01 Ausência de dados sensíveis de terceiros (saúde, imagens identificáveis)
- RS-LGPD-02 Link externo / WhatsApp sem coleta indevida sem aviso
- RS-LGPD-03 Bio e posts sem exposição indevida de dados pessoais de pacientes/clientes
`;

export const CHECKLIST_SITE = `
## CHECKLIST OBRIGATÓRIO — SITE INSTITUCIONAL
Avaliar CADA item aplicável. Superfície = "site".

### Identificação
- ST-ID-01 Nome / razão social identificável
- ST-ID-02 Registro profissional (CRM/OAB/etc.) visível
- ST-ID-03 Contato e endereço ou canais oficiais

### Conteúdo vedado
- ST-PRO-01 Depoimentos / estrelas
- ST-PRO-02 Antes/depois indevido
- ST-PRO-03 Preços / honorários na publicidade
- ST-PRO-04 Promessa de resultado
- ST-PRO-05 Captação indevida / "consulta gratuita"

### LGPD / Marco Civil
- ST-LGPD-01 Política de Privacidade publicada
- ST-LGPD-02 Menção LGPD / direitos do titular
- ST-LGPD-03 Indício de consentimento em formulários
- ST-LGPD-04 Cookies / banner (se detectável)
- ST-LGPD-05 HTTPS ativo
`;

export const CHECKLIST_TRANSVERSAL = `
## TRANSVERSAL (sempre)
- TX-01 Índice coerente com contagens (conformes/total)
- TX-02 Mapear penalidades por esfera (conselho, ANPD, CDC/civil, reputacional)
- TX-03 Plano 7 / 15 / 30 dias com ações concretas
`;
