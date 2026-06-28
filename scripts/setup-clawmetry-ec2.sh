#!/usr/bin/env bash
# ClawMetry na EC2 - observabilidade OpenClaw + systemd user
# Uso: bash scripts/setup-clawmetry-ec2.sh
set -euo pipefail

REPO="${OPENCLAW_REPO:-$HOME/Agente_OpenClaw}"
PORT="${OPENCLAW_CLAWMETRY_PORT:-8900}"
HOST="${OPENCLAW_CLAWMETRY_HOST:-127.0.0.1}"
ENV_FILE="${HOME}/.openclaw/.env"
START_SCRIPT="${HOME}/.openclaw/dashboards/clawmetry/openclaw-start.sh"

echo "=== ClawMetry EC2 (:${PORT}) ==="

if [[ ! -d "$REPO/scripts" ]]; then
  echo "ERRO: repo nao encontrado em $REPO"
  echo "  export OPENCLAW_REPO=/caminho/Agente_OpenClaw"
  exit 1
fi

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

grep -q '^OPENCLAW_CLAWMETRY_PORT=' "$ENV_FILE" 2>/dev/null || {
  echo "OPENCLAW_CLAWMETRY_PORT=${PORT}" >>"$ENV_FILE"
  echo "[env] OPENCLAW_CLAWMETRY_PORT"
}

grep -q '^OPENCLAW_CLAWMETRY_HOST=' "$ENV_FILE" 2>/dev/null || {
  echo "OPENCLAW_CLAWMETRY_HOST=${HOST}" >>"$ENV_FILE"
  echo "[env] OPENCLAW_CLAWMETRY_HOST"
}

echo "[1/2] Instalar clawmetry (pip)..."
bash "$REPO/scripts/install-visual-dashboard.sh" clawmetry

if [[ ! -x "$START_SCRIPT" ]]; then
  echo "ERRO: $START_SCRIPT nao encontrado apos install"
  exit 1
fi

UNIT="${HOME}/.config/systemd/user/openclaw-clawmetry.service"
mkdir -p "$(dirname "$UNIT")"

cat >"$UNIT" <<EOF
[Unit]
Description=OpenClaw ClawMetry observability dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=-${ENV_FILE}
Environment=PATH=${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin
Environment=OPENCLAW_CLAWMETRY_HOST=${HOST}
Environment=OPENCLAW_CLAWMETRY_PORT=${PORT}
ExecStart=${START_SCRIPT}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF

echo ""
echo "[2/2] Systemd user unit: $UNIT"
echo ""
echo "Ativar (persiste apos logout se linger estiver ON):"
echo "  loginctl enable-linger \"\$USER\"   # uma vez, se ainda nao fez"
echo "  systemctl --user daemon-reload"
echo "  systemctl --user enable --now openclaw-clawmetry"
echo "  systemctl --user status openclaw-clawmetry"
echo ""
echo "Tunel no PC: .\scripts\dashboard-tunnel.ps1 -Port ${PORT}"
echo "Browser:     http://127.0.0.1:${PORT}"
echo ""
echo "Logs: journalctl --user -u openclaw-clawmetry -f"
echo "Doc:  docs/DASHBOARDS-VISUAIS.md"
