#!/usr/bin/env bash
# Cole isto na Consola/VNC do FreeVPS (como root). Nao precisa de SSH no PC.
set -euo pipefail

WORKSPACE="/opt/openclaw"
ENV_FILE="${WORKSPACE}/.env"

export DEBIAN_FRONTEND=noninteractive

echo "==> [1/6] Sistema"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl ca-certificates gnupg build-essential git ufw nano

echo "==> [2/6] Node.js 22"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(\".\")[0]')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
node --version

echo "==> [3/6] OpenClaw"
npm install -g openclaw@latest
openclaw --version || true

echo "==> [4/6] Workspace"
mkdir -p "${WORKSPACE}"/{agents,skills,scripts}

if [[ ! -f "${ENV_FILE}" ]]; then
  cat >"${ENV_FILE}" <<'ENV'
# Preencha no servidor (nano /opt/openclaw/.env) ou envie depois com vps-deploy.ps1
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
GOOGLE_API_KEY=
OPENAI_API_KEY=
OPENROUTER_API_KEY=
GITHUB_TOKEN=
GITHUB_OWNER=Aldebaran-LW
MONGODB_URI=
MONGODB_DB_NAME=macofel
VERCEL_API_TOKEN=
VERCEL_TEAM_ID=
ENV
  chmod 600 "${ENV_FILE}"
fi

echo "==> [5/6] systemd"
cat >/etc/systemd/system/openclaw-gateway.service <<'UNIT'
[Unit]
Description=OpenClaw Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/openclaw
EnvironmentFile=-/opt/openclaw/.env
ExecStart=/usr/bin/env openclaw gateway run
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable openclaw-gateway.service

echo "==> [6/6] Firewall"
ufw --force reset || true
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 18789/tcp
ufw --force enable || true

echo ""
echo "=== Instalacao base concluida ==="
echo "1. Edite chaves:  nano ${ENV_FILE}"
echo "2. Onboard:       set -a; source ${ENV_FILE}; set +a"
echo "                  openclaw onboard --non-interactive --accept-risk --mode local \\"
echo "                    --workspace ${WORKSPACE} --auth-choice gemini-api-key \\"
echo "                    --gemini-api-key \"\$GOOGLE_API_KEY\" --gateway-port 18789 --gateway-bind lan \\"
echo "                    --skip-bootstrap --skip-health"
echo "3. Iniciar:       systemctl start openclaw-gateway"
echo "4. Estado:        systemctl status openclaw-gateway"
echo "5. Logs:          journalctl -u openclaw-gateway -f"
echo ""
echo "Quando SSH no PC funcionar: .\\scripts\\vps-deploy.ps1 (envia agents/skills/.env)"
