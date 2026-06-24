# VeltroDigital

Site institucional da agência **Veltro Digital** — transformação digital para médicos, advogados e academias.

## Páginas

| Rota | Arquivo |
|------|---------|
| `/` | `index.html` |
| `/medicos` | `medicos.html` |
| `/advogados` | `advogados.html` |
| `/esporte` | `esporte.html` |
| `/arquitetura` | `arquitetura.html` |

## Desenvolvimento

Site estático (HTML, CSS e JavaScript). Contatos e links em `js/config.js`.

```bash
# Servir localmente (Python)
python3 -m http.server 8080

# Ou com npx
npx serve .
```

## Publicar na Vercel

1. Conecte o repositório GitHub no [dashboard da Vercel](https://vercel.com/new).
2. Framework preset: **Other** (site estático).
3. Deploy automático a cada push na branch `main`.

Ou via CLI:

```bash
npx vercel --prod
```

## Domínio (www.veltrodigital.com.br)

O projeto está configurado na Vercel. No painel DNS do domínio (Registro.br ou provedor), adicione:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| A | `www` | `76.76.21.21` |

O endereço raiz (`veltrodigital.com.br`) redireciona automaticamente para `www.veltrodigital.com.br`.

Verifique o status em: [Vercel → veltrodigital → Domains](https://vercel.com/leandroeriksonoliveira1/veltrodigital/settings/domains)

## Contato

- WhatsApp: (11) 98644-6779
- E-mail: contato@veltrodigital.com.br
- Site: https://www.veltrodigital.com.br
