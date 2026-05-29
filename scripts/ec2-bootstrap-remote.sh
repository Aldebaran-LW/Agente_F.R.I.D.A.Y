#!/usr/bin/env bash
# Executado na EC2 via ec2-bootstrap-from-pc.ps1
set -euo pipefail
echo "==> Disco antes"
df -h /
sudo apt-get clean -qq 2>/dev/null || true
sudo journalctl --vacuum-size=50M 2>/dev/null || true
echo "==> Clone repo"
sudo rm -rf /opt/openclaw
sudo git clone --depth 1 https://github.com/Aldebaran-LW/Agente_OpenClaw.git /opt/openclaw
sed -i 's/\r$//' /tmp/openclaw.env
sed -i '1s/^\xEF\xBB\xBF//' /tmp/openclaw.env 2>/dev/null || true
sudo mv /tmp/openclaw.env /opt/openclaw/.env
sudo chmod 600 /opt/openclaw/.env
sudo chown -R ubuntu:ubuntu /opt/openclaw
cd /opt/openclaw
set -a
# shellcheck source=/dev/null
source .env
set +a
export PATH="/usr/local/bin:$PATH"
export OPENCLAW_CONFIG=/root/.openclaw/openclaw.json
if ! grep -q '^OLLAMA_API_KEY=' .env 2>/dev/null; then
  echo 'OLLAMA_API_KEY=ollama-local' | sudo tee -a /opt/openclaw/.env >/dev/null
fi
echo "==> Sync modelos OpenRouter por cerebro"
sudo bash scripts/ec2-apply-agent-config.sh
echo "==> Restart gateway"
sudo systemctl daemon-reload
sudo systemctl restart openclaw-gateway
sleep 3
sudo systemctl is-active openclaw-gateway
df -h /
ls -la /opt/openclaw/scripts/ec2-apply-agent-config.sh
