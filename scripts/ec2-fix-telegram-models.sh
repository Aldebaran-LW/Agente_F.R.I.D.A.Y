#!/usr/bin/env bash
# EC2: Groq/Infron/DeepSeek/HF (orchestrator Telegram) + gateway (operacional). Sem OpenRouter.
set -euo pipefail
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
cd "${OPENCLAW_ROOT:-/opt/openclaw}"
set -a; source .env 2>/dev/null || true; set +a
export PATH="/usr/local/bin:$PATH"
export OPENCLAW_CONFIG

node scripts/sync-agent-config-to-openclaw.mjs --apply 2>/dev/null || true
node scripts/ec2-tiered-llm-patch.mjs "$OPENCLAW_CONFIG"

WORKSPACE_DIR="$(dirname "$OPENCLAW_CONFIG")/workspace"
SOUL_SRC="/opt/openclaw/agents/_shared/SOUL-TELEGRAM-JARVIS.md"
[[ -f "$SOUL_SRC" ]] && mkdir -p "$WORKSPACE_DIR" && cp "$SOUL_SRC" "$WORKSPACE_DIR/SOUL.md"

openclaw config set agents.defaults.compaction.reserveTokensFloor 20000 2>/dev/null || true
openclaw config set tools.profile messaging 2>/dev/null || true

openclaw config validate

CLEAR_SESSIONS_NO_RESTART=1 bash scripts/ec2-clear-sessions.sh 2>/dev/null || true

systemctl restart openclaw-gateway
sleep 4
systemctl is-active openclaw-gateway
ORCH_PRIMARY="$(openclaw config get agents.list.0.model.primary 2>/dev/null || echo '?')"
echo "Telegram: /new | orchestrator=${ORCH_PRIMARY} | heimdall=gateway (openclaw-jarvis)"
