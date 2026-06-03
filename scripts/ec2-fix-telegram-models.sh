#!/usr/bin/env bash
# EC2: Groq/Infron/DeepSeek/HF (orchestrator Telegram) + gateway (operacional). Sem OpenRouter.
set -euo pipefail
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
cd "${OPENCLAW_ROOT:-/opt/openclaw}"
set -a; source .env 2>/dev/null || true; set +a
export PATH="/usr/local/bin:$PATH"
export OPENCLAW_CONFIG

node scripts/sync-agent-config-to-openclaw.mjs --apply 2>/dev/null || true
TIERED_ARGS=()
if [[ "${EC2_PROFILE:-}" == "minimal" ]]; then
  TIERED_ARGS=(--minimal)
fi
node scripts/ec2-tiered-llm-patch.mjs "${TIERED_ARGS[@]}" "$OPENCLAW_CONFIG"

WORKSPACE_DIR="$(dirname "$OPENCLAW_CONFIG")/workspace"
SOUL_SRC="/opt/openclaw/agents/_shared/SOUL-TELEGRAM-JARVIS.md"
[[ -f "$SOUL_SRC" ]] && mkdir -p "$WORKSPACE_DIR" && cp "$SOUL_SRC" "$WORKSPACE_DIR/SOUL.md"

openclaw config set agents.defaults.compaction.reserveTokensFloor 20000 2>/dev/null || true
openclaw config unset tools.profile 2>/dev/null || true

openclaw config validate

CLEAR_SESSIONS_NO_RESTART=1 bash scripts/ec2-clear-sessions.sh 2>/dev/null || true

# Ollama smollm2 não serve Telegram (4096 ctx); libertar RAM na EC2
if systemctl is-active ollama &>/dev/null; then
  systemctl stop ollama 2>/dev/null || true
  systemctl disable ollama 2>/dev/null || true
  echo "Ollama parado (inferencia local -> HF Router / Space friday-prod)"
fi

systemctl restart openclaw-gateway
sleep 4
systemctl is-active openclaw-gateway
ORCH_PRIMARY="$(node -e "const f=process.env.OPENCLAW_CONFIG||'/root/.openclaw/openclaw.json';const d=JSON.parse(require('fs').readFileSync(f,'utf8'));console.log(d.agents?.list?.find(x=>x.id==='orchestrator')?.model?.primary||'?')")"
echo "Telegram: /new | orchestrator=${ORCH_PRIMARY} | ops=gateway (openclaw-jarvis)"
