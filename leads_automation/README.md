# Automação de prospecção + conformidade (Veltro Digital)

## O que faz

1. Busca até **100 leads/dia** por região (clínicas, médicos, dentistas, psicólogos, terapeutas, advogados, academias, fisioterapeutas) — rodízio diário entre regiões do Brasil.
2. Analisa conformidade do site **em memória** (score 0–100 + risco).
3. **Append** no Excel acumulativo `data/leads_conformidade_brasil.xlsx`.
4. Envia e-mail com resumo + anexo para `EMAIL_TO`.

## Setup rápido

```bash
cd leads_automation
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Preencha as chaves (ou use o helper interativo):
./scripts/setup_env.sh
```

**Credenciais opcionais no `.env`:**
1. `GOOGLE_PLACES_API_KEY` — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Places API, opcional)
2. `LEAD_SOURCE=auto|web|places|demo` — padrão `auto` (web gratuita sem chave)
3. `SMTP_PASSWORD` — senha de app do Hotmail/Outlook (conta com MFA)

Sem Places API, o sistema usa **busca web gratuita** (DuckDuckGo) por região e categoria. Se a busca falhar, cai no catálogo demo.

## Teste manual

```bash
# Demo sem API key (leads stub) — não grava Excel nem envia e-mail
python main.py --regiao=Sudeste --limit=3 --dry-run

# Grava Excel, não envia e-mail
python main.py --regiao=Sudeste --limit=5 --skip-email

# Produção (região do rodízio, até 100 leads, + e-mail se SMTP configurado)
python main.py

# Produção sem e-mail (Cloud Agent / cron) — até 100 leads (DEFAULT_LIMIT)
python main.py --skip-email

# Não use --limit=20 na automação Cursor; o padrão já é 100.
# Prompt canônico: CURSOR_AUTOMATION.md
```

## Rodízio de regiões

Ordem: Norte → Nordeste → Centro-Oeste → Sudeste → Sul → (repete).

Estado salvo em `data/region_rotation.json`. Com `--regiao=` o rodízio **não** é o alvo forçado do arquivo na próxima execução automática (só usa override naquele run; ao rodar sem flag, avança o índice).

## Agendamento — cron (05:00 Brasília)

**Já instalado neste Mac** (verifique com `crontab -l`):

```cron
0 5 * * * TZ=America/Sao_Paulo cd /Users/leandrooliveira/Documents/veltrodigital/leads_automation && /Users/leandrooliveira/Documents/veltrodigital/leads_automation/.venv/bin/python main.py >> /Users/leandrooliveira/Documents/veltrodigital/leads_automation/logs/cron.log 2>&1
```

Para remover: `crontab -e` e apague a linha `leads_automation`.

Logs do cron: `leads_automation/logs/cron.log`

## Colunas do Excel

`Data da Coleta | Região | Estado | Cidade | Categoria | Nome do Negócio | Website | Telefone | WhatsApp | E-mail | Score de Conformidade | Nível de Risco`

## Módulos

| Arquivo | Função |
|---------|--------|
| `modules/lead_finder.py` | Web (DuckDuckGo), Places API ou demo |
| `modules/web_search.py` | Busca gratuita na internet |
| `modules/compliance_analyzer.py` | Score em memória (stub evolutivo) |
| `modules/excel_consolidator.py` | Append + dedupe por domínio |
| `modules/email_sender.py` | SMTP + template |

## Próximos passos

1. Opcional: `GOOGLE_PLACES_API_KEY` no `.env` para Places em vez de busca web.
2. Configurar SMTP Hotmail (senha de app se MFA estiver ativo).
3. Endurecer `compliance_analyzer.py` com regras da skill `site-compliance-audit`.
4. Ativar o cron após validar `--skip-email`.
