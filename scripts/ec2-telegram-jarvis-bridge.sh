#!/usr/bin/env bash
# EC2: serviço systemd para ponte Telegram → Jarvis (comandos + botões, sem LLM).
set -euo pipefail
OPENCLAW_ROOT="${OPENCLAW_ROOT:-/opt/openclaw}"
UNIT_NAME="openclaw-telegram-jarvis-bridge"
SERVICE_FILE="/etc/systemd/system/${UNIT_NAME}.service"

cd "$OPENCLAW_ROOT"
set -a
# shellcheck source=/dev/null
source .env 2>/dev/null || true
set +a

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "ERRO: TELEGRAM_BOT_TOKEN no .env"
  exit 1
fi
if [[ -z "${OPENCLAW_GATEWAY_BASE_URL:-}" ]] || [[ -z "${OPENCLAW_AUTOMATION_TOKEN:-}" ]]; then
  echo "ERRO: OPENCLAW_GATEWAY_BASE_URL e OPENCLAW_AUTOMATION_TOKEN no .env"
  exit 1
fi

NODE_BIN="$(command -v node)"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=OpenClaw Telegram Jarvis bridge (buttons + /jarvis)
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${OPENCLAW_ROOT}
EnvironmentFile=${OPENCLAW_ROOT}/.env
ExecStart=${NODE_BIN} scripts/telegram-jarvis-bridge.mjs --poll
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$UNIT_NAME"
systemctl restart "$UNIT_NAME"
sleep 2
systemctl --no-pager status "$UNIT_NAME" || true
echo ""
echo "OK: ${UNIT_NAME} activo. Logs: journalctl -u ${UNIT_NAME} -f"
echo "Requer redeploy Vercel (gateway) com reply_markup. Teste: node scripts/telegram-jarvis-bridge.mjs --poll-once"
