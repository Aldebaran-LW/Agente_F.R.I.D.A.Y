#!/usr/bin/env bash
# Instala Node 22 + OpenClaw no VPS (Ubuntu/Debian). Executar como root.
set -euo pipefail

WORKSPACE="${OPENCLAW_WORKSPACE:-/opt/openclaw}"
ENV_FILE="${OPENCLAW_ENV:-/opt/openclaw/.env}"

export DEBIAN_FRONTEND=noninteractive

echo "==> Atualizar sistema"
apt-get update -qq
apt-get upgrade -y -qq

echo "==> Pacotes base"
apt-get install -y -qq curl ca-certificates gnupg build-essential git ufw

echo "==> Node.js 22"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p process.versions.node.split('.')[0])" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
node --version
npm --version

echo "==> OpenClaw CLI"
npm install -g openclaw@latest
openclaw --version || true

echo "==> Workspace ${WORKSPACE}"
mkdir -p "${WORKSPACE}"/{agents,skills,scripts}
chown -R root:root "${WORKSPACE}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

echo "==> Onboard (se ainda não configurado)"
if [[ ! -d /root/.openclaw ]] || [[ ! -f /root/.openclaw/openclaw.json ]]; then
  if [[ -n "${GOOGLE_API_KEY:-}" ]]; then
    openclaw onboard --non-interactive --accept-risk --mode local \
      --workspace "${WORKSPACE}" \
      --auth-choice google-api-key --google-api-key "${GOOGLE_API_KEY}" \
      --skip-bootstrap --skip-health || true
  else
    echo "AVISO: GOOGLE_API_KEY ausente em ${ENV_FILE} — corra openclaw onboard manualmente."
  fi
fi

echo "==> Serviço systemd openclaw-gateway"
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

echo "==> Firewall (SSH + gateway 18789)"
ufw --force reset || true
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 18789/tcp
ufw --force enable || true

if [[ -f "${WORKSPACE}/scripts/install-heartbeat-timer.sh" ]]; then
  echo "==> Heartbeat timer (opcional — requer TELEGRAM_ADMIN_CHAT_ID no .env)"
  bash "${WORKSPACE}/scripts/install-heartbeat-timer.sh" || echo "AVISO: heartbeat nao instalado (ver docs/HEARTBEAT.md)"
fi

echo "==> Concluído. Próximo: systemctl start openclaw-gateway && systemctl status openclaw-gateway"
