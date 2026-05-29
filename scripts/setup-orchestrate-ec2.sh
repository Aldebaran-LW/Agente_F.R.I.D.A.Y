#!/usr/bin/env bash
# Webhook EC2 :8790 (Friday Vercel -> Jarvis) + systemd user
# Uso: bash scripts/setup-orchestrate-ec2.sh
set -euo pipefail

REPO="${OPENCLAW_REPO:-$HOME/Agente_OpenClaw}"
PORT="${OPENCLAW_ORCHESTRATE_PORT:-8790}"
HOST="${OPENCLAW_ORCHESTRATE_HOST:-127.0.0.1}"
ENV_FILE="${HOME}/.openclaw/.env"

echo "=== OpenClaw Orchestrate Hook EC2 (:${PORT}) ==="

if [[ ! -d "$REPO/scripts" ]]; then
  echo "ERRO: repo nao encontrado em $REPO"
  echo "  export OPENCLAW_REPO=/caminho/Agente_OpenClaw"
  exit 1
fi

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

grep -q '^OPENCLAW_ORCHESTRATE_PORT=' "$ENV_FILE" 2>/dev/null || {
  echo "OPENCLAW_ORCHESTRATE_PORT=${PORT}" >>"$ENV_FILE"
  echo "[env] OPENCLAW_ORCHESTRATE_PORT"
}

grep -q '^OPENCLAW_ORCHESTRATE_HOST=' "$ENV_FILE" 2>/dev/null || {
  echo "OPENCLAW_ORCHESTRATE_HOST=${HOST}" >>"$ENV_FILE"
  echo "[env] OPENCLAW_ORCHESTRATE_HOST"
}

grep -q '^OPENCLAW_ORCHESTRATE_PUSH_URL=' "$ENV_FILE" 2>/dev/null || {
  echo "OPENCLAW_ORCHESTRATE_PUSH_URL=http://127.0.0.1:${PORT}" >>"$ENV_FILE"
  echo "[env] OPENCLAW_ORCHESTRATE_PUSH_URL"
}

if ! grep -q '^OPENCLAW_INTERNAL_TOKEN=' "$ENV_FILE" 2>/dev/null \
  && ! grep -q '^OPENCLAW_AUTOMATION_TOKEN=' "$ENV_FILE" 2>/dev/null; then
  echo "AVISO: defina OPENCLAW_INTERNAL_TOKEN ou OPENCLAW_AUTOMATION_TOKEN em $ENV_FILE"
fi

UNIT="${HOME}/.config/systemd/user/openclaw-orchestrate.service"
mkdir -p "$(dirname "$UNIT")"

cat >"$UNIT" <<EOF
[Unit]
Description=OpenClaw EC2 Orchestrate Webhook (Friday broker)
After=network.target

[Service]
Type=simple
WorkingDirectory=${REPO}/scripts
EnvironmentFile=-${ENV_FILE}
Environment=OPENCLAW_ORCHESTRATE_PORT=${PORT}
Environment=OPENCLAW_ORCHESTRATE_HOST=${HOST}
ExecStart=/usr/bin/env node ec2-orchestrate-hook.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

echo ""
echo "Systemd user unit: $UNIT"
echo ""
echo "Ativar:"
echo "  systemctl --user daemon-reload"
echo "  systemctl --user enable --now openclaw-orchestrate"
echo "  systemctl --user status openclaw-orchestrate"
echo ""
echo "Teste local:"
echo "  curl -s http://127.0.0.1:${PORT}/health"
echo ""
echo "HTTPS publico: bash scripts/install-nginx-ec2-hooks.sh"
echo "Doc: docs/EC2-ORCHESTRATE-WEBHOOK.md"
