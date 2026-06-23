#!/usr/bin/env bash
# Verifica assets de imagem da seção de serviços antes do deploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

required=(
  index.html
  images/examples/fisioperform.png
  images/examples/dra-ingrid.png
  images/examples/ia-simple.svg
)

for f in "${required[@]}"; do
  [[ -f "$f" ]] || { echo "ERRO: arquivo ausente: $f" >&2; exit 1; }
done

grep -q 'service-ai-svg' index.html || { echo "ERRO: SVG de IA inline ausente no index.html" >&2; exit 1; }
grep -q 'service-example-img' index.html || { echo "ERRO: imagens de sites ausentes no index.html" >&2; exit 1; }

echo "OK: imagens da seção serviços verificadas."
