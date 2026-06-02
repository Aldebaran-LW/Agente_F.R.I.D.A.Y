#!/usr/bin/env bash
# fix-hf-fallback-ollama.sh — deploy friday-prod com fallback Ollama (sem sed no Space clonado).
#
# O app.py em hf-space/friday-prod já inclui: OpenRouter → HF Inference → Ollama (OLLAMA_API_URL).
#
# Windows (recomendado):
#   powershell -File scripts/hf-deploy-space.ps1 -Space friday-prod -ConfigureSecrets
#
# Linux/macOS/Git Bash:
#   bash scripts/fix-hf-fallback-ollama.sh
#
# Pré-requisitos:
#   - HF_TOKEN no .env
#   - Ollama na EC2 a escutar (ex.: ec2-install-ollama.sh + security group só para IPs HF, se expuser :11434)
#   - OLLAMA_API_URL no .env (ex.: http://SEU_IP_EC2:11434)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERRO: .env em falta em $ROOT"
  exit 1
fi

# shellcheck disable=SC1091
set -a
source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | sed 's/\r$//')
set +a

if [[ -z "${HF_TOKEN:-}" ]]; then
  echo "ERRO: HF_TOKEN em falta no .env"
  exit 1
fi

echo "==> Regenerar agents-config.yaml"
node scripts/generate-hf-agents-config.mjs

echo "==> Configurar secrets/variables do Space (OLLAMA_API_URL, etc.)"
node scripts/hf-configure-friday-prod.mjs

REPO="${HF_FRIDAY_SPACE_REPO:-Aldebaran-LW/friday-prod}"
WORK="${TMPDIR:-/tmp}/hf-deploy-friday-prod-$$"
rm -rf "$WORK"
mkdir -p "$WORK"

HF_USER="${HF_USERNAME:-$(echo "$REPO" | cut -d/ -f1)}"
echo "==> Clone spaces/$REPO"
git clone "https://${HF_USER}:${HF_TOKEN}@huggingface.co/spaces/${REPO}" "$WORK"

echo "==> Copiar hf-space/friday-prod"
for dir in tools lib; do
  rm -rf "$WORK/$dir"
done
rsync -a --exclude '.git' --exclude '__pycache__' --exclude 'desktop.ini' \
  "$ROOT/hf-space/friday-prod/" "$WORK/"

cd "$WORK"
git add -A
if git diff --staged --quiet; then
  echo "[OK] Space já estava atualizado (nada para commitar)."
else
  git commit -m "fix: fallback Ollama quando OpenRouter/HF Inference falham (402)"
  git push
  echo "[OK] Push concluído — rebuild do Space em ~2–3 min."
fi

SLUG="$(echo "$REPO" | tr '/' '-')"
echo ""
echo "Health: https://${SLUG,,}.hf.space/health  (campo ollama: true se OLLAMA_API_URL definido)"
echo "Teste:  POST https://${SLUG,,}.hf.space/run/sophia  body {\"task\":\"ping\"}"
if [[ -z "${OLLAMA_API_URL:-}" ]]; then
  echo ""
  echo "AVISO: OLLAMA_API_URL vazio no .env — fallback Ollama no Space não vai activar."
  echo "       Adiciona ex.: OLLAMA_API_URL=http://IP_EC2:11434 e volta a correr este script."
fi

rm -rf "$WORK"
