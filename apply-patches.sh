#!/usr/bin/env bash
# apply-patches.sh — aplica todos os patches OpenClaw de uma vez
# Uso: bash apply-patches.sh [caminho-do-repo]
# Exemplo: bash apply-patches.sh "H:/Meu Drive/Projetos/OpenClaw"
set -euo pipefail

REPO="${1:-$(pwd)}"
PATCHES="$(dirname "$0")"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}  $*"; }
warn() { echo -e "${YELLOW}[SKIP]${NC} $*"; }

echo ""
echo "Aplicando patches em: $REPO"
echo ""

# ── Agentes (8 configs) ───────────────────────────────────────────────────────
AGENTS=(dedalo icaro rebeca rimuru sophia veldora vp-pecas yato)
for agent in "${AGENTS[@]}"; do
  SRC="$PATCHES/agents/${agent}-config.yaml"
  DST="$REPO/agents/$agent/config.yaml"
  if [ -f "$DST" ]; then
    cp "$SRC" "$DST"
    ok "agents/$agent/config.yaml → HF Inference + Groq fallback"
  else
    warn "agents/$agent/config.yaml não encontrado — pulando"
  fi
done

echo ""

# ── openrouter_client.py (stub nos 4 HF Spaces) ───────────────────────────────
SPACES=(friday-prod core innovation macofel)
for space in "${SPACES[@]}"; do
  DST="$REPO/hf-space/$space/lib/openrouter_client.py"
  if [ -f "$DST" ]; then
    cp "$PATCHES/hf-space/openrouter_client.py" "$DST"
    ok "hf-space/$space/lib/openrouter_client.py → stub seguro"
  else
    warn "hf-space/$space/lib/openrouter_client.py não existe — pulando"
  fi
done

echo ""

# ── Verificação final ─────────────────────────────────────────────────────────
echo "Verificando providers após patch:"
grep -h "provider:" "$REPO"/agents/*/config.yaml | sort | uniq -c | sort -rn

echo ""
echo "Próximos passos:"
echo "  1. git add agents/ hf-space/"
echo "  2. git commit -m 'fix: migrar 8 agentes ollama→HF, stub OpenRouter'"
echo "  3. git push main   ← Vercel faz deploy automático"
echo "  4. No HF Space friday-prod: Factory Restart (para recarregar os tools)"
echo ""
