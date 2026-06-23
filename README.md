# VeltroDigital

Site institucional da agência **Veltro Digital** — transformação digital para médicos, advogados e academias.

## Páginas

| Rota | Arquivo |
|------|---------|
| `/` | `index.html` |
| `/medicos` | `medicos.html` |
| `/advogados` | `advogados.html` |
| `/academias` | `academias.html` |

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

## Contato

- WhatsApp: (11) 98644-6779
- E-mail: contato@veltrodigital.com.br
- Local: Volta Redonda, RJ
