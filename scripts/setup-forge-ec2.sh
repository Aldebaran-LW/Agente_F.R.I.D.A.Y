#!/usr/bin/env bash
# Digital Forge na EC2 — WS server + variáveis
set -euo pipefail

REPO="${OPENCLAW_REPO:-$HOME/Agente_OpenClaw}"
PORT="${OPENCLAW_FORGE_WS_PORT:-8787}"

echo "=== Digital Forge EC2 ==="
cd "$REPO/scripts"
npm install

grep -q OPENCLAW_FORGE_PUSH_URL "$HOME/.openclaw/.env" 2>/dev/null || {
  echo "" >> "$HOME/.openclaw/.env"
  echo "OPENCLAW_FORGE_PUSH_URL=http://127.0.0.1:${PORT}" >> "$HOME/.openclaw/.env"
  echo "[env] OPENCLAW_FORGE_PUSH_URL adicionado a ~/.openclaw/.env"
}

UNIT="$HOME/.config/systemd/user/openclaw-forge.service"
mkdir -p "$(dirname "$UNIT")"
cat > "$UNIT" <<EOF
[Unit]
Description=OpenClaw Digital Forge WebSocket
After=network.target

[Service]
Type=simple
WorkingDirectory=${REPO}/scripts
Environment=OPENCLAW_FORGE_WS_PORT=${PORT}
ExecStart=/usr/bin/env node forge-ws-server.mjs
Restart=on-failure

[Install]
WantedBy=default.target
EOF

echo ""
echo "Ativar (opcional):"
echo "  systemctl --user daemon-reload"
echo "  systemctl --user enable --now openclaw-forge"
echo ""
echo "Manual: cd scripts && npm run forge"
echo "Painel: https://<gateway>/forge"
echo "Doc: docs/DIGITAL-FORGE-FRIDAY.md"
