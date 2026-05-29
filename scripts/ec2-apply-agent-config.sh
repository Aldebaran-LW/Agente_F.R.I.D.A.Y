#!/usr/bin/env bash
# EC2: aplicar agents/*/config.yaml ao daemon OpenClaw
set -euo pipefail
OPENCLAW_ROOT="${OPENCLAW_ROOT:-/opt/openclaw}"
cd "$OPENCLAW_ROOT"
set -a
source .env 2>/dev/null || true
set +a
export PATH="/usr/local/bin:$PATH"
export OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
if [[ ! -f "$OPENCLAW_CONFIG" ]]; then
  echo "ERRO: $OPENCLAW_CONFIG nao existe. Corra openclaw onboard primeiro."
  exit 1
fi
node scripts/sync-agent-config-to-openclaw.mjs --apply
echo "OK modelos por cerebro aplicados em $OPENCLAW_CONFIG"

WORKSPACE_DIR="$(dirname "$OPENCLAW_CONFIG")/workspace"
SOUL_SRC="$OPENCLAW_ROOT/agents/_shared/SOUL-TELEGRAM-JARVIS.md"
if [[ -f "$SOUL_SRC" ]]; then
  mkdir -p "$WORKSPACE_DIR"
  cp "$SOUL_SRC" "$WORKSPACE_DIR/SOUL.md"
  echo "OK SOUL.md Jarvis PT em $WORKSPACE_DIR/SOUL.md"
fi