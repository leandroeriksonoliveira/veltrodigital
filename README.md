# Veltro Digital

Site institucional + **Analisador de Conformidade Digital** (Next.js).

## Stack

- Páginas de marketing: HTML estático em `public/`
- App Router: `/analisador` (cliente) e `/admin/reports` (interno)
- API: `/api/analisar`, `/api/admin/*`
- Banco: **Postgres Neon na Vercel Storage** (`db/schema.sql`)
- IA: OpenAI (`gpt-4o`) ou Anthropic (Claude)

## Banco de dados (Vercel)

1. No projeto Vercel → **Storage** → **Create Database** → **Neon**
2. A variável `DATABASE_URL` (ou `POSTGRES_URL`) é injetada automaticamente
3. Aplique o schema:

```bash
# puxe as env do projeto
vercel env pull .env.local --yes

# rode o SQL no Neon Console (SQL Editor) colando db/schema.sql
# ou via psql:
psql "$DATABASE_URL" -f db/schema.sql
```

## Setup local

```bash
cp .env.example .env.local
# preencha DATABASE_URL, OPENAI_API_KEY (ou ANTHROPIC) e ADMIN_PASSWORD

npm install
npm run dev
```

- Público: http://localhost:3000/analisador  
- Admin: http://localhost:3000/admin/reports  

## Separação de relatórios

| Relatório | Onde | Conteúdo |
|-----------|------|----------|
| **Client report** | Tela `/analisador` + tabela `client_reports` | Nota 0–100, selo, CTA genérico, **penalidades possíveis em valores** (sem detalhar o erro) |
| **Internal report** | `/admin/reports` + tabela `internal_reports` | Red flags, normas, correções, pitch comercial — **nunca** retornado pela API pública |

## Fluxo

1. Usuário envia texto/bio, print (com transcrição), link de referência (sem scraping) ou URL de site.
2. Sites: coleta HTML pública (`lib/conformidade/site-audit.ts`) alinhada à skill de conformidade.
3. LLM gera JSON com os dois blocos.
4. Backend salva lead + ambos os relatórios no Postgres Vercel; responde só `client_report`.
5. Se selo ≠ Aprovado, dispara webhook comercial (`COMMERCIAL_NOTIFY_WEBHOOK`).

## Deploy Vercel

Framework: **Next.js**. Defina as variáveis de `.env.example` (exceto `DATABASE_URL`, que vem do Storage Neon).
