#!/usr/bin/env bash
# Preenche GOOGLE_PLACES_API_KEY e SMTP_PASSWORD no .env (interativo).
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=.env
[[ -f "$ENV_FILE" ]] || cp .env.example "$ENV_FILE"

echo "Cole a GOOGLE_PLACES_API_KEY (Enter para pular):"
read -r KEY
echo "Cole a SMTP_PASSWORD / senha de app Hotmail (Enter para pular):"
read -rs PASS
echo

if [[ -n "${KEY}" ]]; then
  sed -i.bak "s|^GOOGLE_PLACES_API_KEY=.*|GOOGLE_PLACES_API_KEY=${KEY}|" "$ENV_FILE"
fi
if [[ -n "${PASS}" ]]; then
  sed -i.bak "s|^SMTP_PASSWORD=.*|SMTP_PASSWORD=${PASS}|" "$ENV_FILE"
fi
rm -f "${ENV_FILE}.bak"
echo "Atualizado: $(pwd)/$ENV_FILE"
grep -E '^(SMTP_USER|EMAIL_TO)=' "$ENV_FILE"
echo "GOOGLE_PLACES_API_KEY=$([ -n "$(grep '^GOOGLE_PLACES_API_KEY=.' "$ENV_FILE")" ] && echo 'definida' || echo 'vazia')"
echo "SMTP_PASSWORD=$([ -n "$(grep '^SMTP_PASSWORD=.' "$ENV_FILE")" ] && echo 'definida' || echo 'vazia')"
