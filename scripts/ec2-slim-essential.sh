#!/usr/bin/env bash
# EC2: perfil mínimo — só Telegram + gateway + heartbeat (transição → servidor físico)
# Uso: sudo EC2_PROFILE=minimal bash scripts/ec2-slim-essential.sh
# Do PC: incluído em ec2-sync-now quando EC2_PROFILE=minimal no .env da EC2
set -euo pipefail

OPENCLAW_ROOT="${OPENCLAW_ROOT:-/opt/openclaw}"
cd "$OPENCLAW_ROOT" || exit 1
export OPENCLAW_ROOT
export PATH="/usr/local/bin:$PATH"
export OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"

echo "==> ec2-slim-essential $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# --- disco ---
if [[ -f scripts/ec2-disk-cleanup.sh ]]; then
  bash scripts/ec2-disk-cleanup.sh || true
fi

# --- lixo local conhecido (~225 MB) ---
if [[ -d /home/ubuntu/macofel/.venv-macofel-agent ]]; then
  echo "==> Remover venv Macofel (catálogo = Render, não EC2)"
  rm -rf /home/ubuntu/macofel/.venv-macofel-agent
fi
find /home/ubuntu -maxdepth 3 -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true

# --- serviços opcionais (não duplicar Telegram) ---
for u in \
  openclaw-telegram-jarvis-bridge \
  openclaw-clawmetry \
  ollama; do
  if systemctl is-enabled "$u" &>/dev/null; then
    echo "==> disable $u"
    systemctl stop "$u" 2>/dev/null || true
    systemctl disable "$u" 2>/dev/null || true
  fi
done
# user units (forge / orchestrate)
for u in openclaw-forge openclaw-orchestrate; do
  systemctl --user stop "$u" 2>/dev/null || true
  systemctl --user disable "$u" 2>/dev/null || true
done

# --- openclaw.json: só orchestrator + tools.exec ---
if [[ -f scripts/ec2-tiered-llm-patch.mjs ]]; then
  node scripts/ec2-tiered-llm-patch.mjs --minimal "$OPENCLAW_CONFIG"
fi

# --- SOUL Jarvis PT ---
SOUL_SRC="$OPENCLAW_ROOT/agents/_shared/SOUL-TELEGRAM-JARVIS.md"
WORKSPACE_DIR="$(dirname "$OPENCLAW_CONFIG")/workspace"
if [[ -f "$SOUL_SRC" ]]; then
  mkdir -p "$WORKSPACE_DIR"
  cp "$SOUL_SRC" "$WORKSPACE_DIR/SOUL.md"
fi

openclaw config set agents.defaults.compaction.reserveTokensFloor 20000 2>/dev/null || true
openclaw config validate 2>/dev/null || true

CLEAR_SESSIONS_NO_RESTART=1 bash scripts/ec2-clear-sessions.sh 2>/dev/null || true

systemctl restart openclaw-gateway
sleep 3

if [[ -f scripts/systemd/openclaw-heartbeat.timer ]]; then
  cp -f scripts/systemd/openclaw-heartbeat.{service,timer} /etc/systemd/system/ 2>/dev/null || true
  systemctl daemon-reload
  systemctl enable --now openclaw-heartbeat.timer 2>/dev/null || true
fi

echo ""
echo "==> Estado"
df -h / | tail -1
systemctl is-active openclaw-gateway 2>/dev/null || echo "gateway: inactive"
systemctl is-active openclaw-heartbeat.timer 2>/dev/null || echo "heartbeat: inactive"
AGENTS="$(node -e "const o=require('$OPENCLAW_CONFIG');console.log((o.agents?.list||[]).map(a=>a.id).join(','))" 2>/dev/null || echo '?')"
echo "agentes openclaw.json: $AGENTS"
echo ""
echo "OK slim. Telegram: /new → ajuda"
echo "Doc: docs/EC2-MINIMAL.md"
