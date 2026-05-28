#!/usr/bin/env bash
# OpenClaw — preparar EC2 para Claw3D / openclaw-office (WebSocket gateway)
set -euo pipefail

OPENCLAW_WS_PORT="${OPENCLAW_WS_PORT:-18789}"
OPENCLAW_SERVICE="${OPENCLAW_SERVICE:-openclaw}"

echo "=== OpenClaw · Setup Claw3D (EC2) ==="
echo ""

if ! command -v openclaw >/dev/null 2>&1; then
  echo "[AVISO] Comando 'openclaw' não encontrado no PATH."
  echo "        Instala o OpenClaw antes de ligar o Claw3D."
else
  echo "[1] openclaw doctor"
  openclaw doctor || true
  echo ""
fi

echo "[2] Serviço systemd (se existir)"
if systemctl list-units --type=service --all 2>/dev/null | grep -q "${OPENCLAW_SERVICE}"; then
  systemctl is-active "${OPENCLAW_SERVICE}" || true
  systemctl status "${OPENCLAW_SERVICE}" --no-pager -l 2>/dev/null | head -n 12 || true
else
  echo "    Unidade ${OPENCLAW_SERVICE} não encontrada — ignora se corres openclaw manualmente."
fi
echo ""

echo "[3] Porta WebSocket local"
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null | grep -E ":${OPENCLAW_WS_PORT}\\b" || echo "    Nada a escutar em :${OPENCLAW_WS_PORT} (ainda)."
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp 2>/dev/null | grep -E ":${OPENCLAW_WS_PORT}\\b" || echo "    Nada a escutar em :${OPENCLAW_WS_PORT} (ainda)."
fi
echo ""

ENV_FILE="${OPENCLAW_ENV_FILE:-/opt/openclaw/.env}"
if [[ -f "${ENV_FILE}" ]]; then
  echo "[4] Variáveis em ${ENV_FILE}"
  grep -E '^(OPENCLAW_GATEWAY_BASE_URL|OPENCLAW_AUTOMATION_TOKEN)=' "${ENV_FILE}" 2>/dev/null | sed 's/=.*/=***/' || true
else
  echo "[4] ${ENV_FILE} não encontrado — cria com OPENCLAW_GATEWAY_BASE_URL + token Vercel."
fi
echo ""

WS_URL="ws://127.0.0.1:${OPENCLAW_WS_PORT}"
echo "=== Ligação Claw3D / openclaw-office ==="
echo ""
echo "  WebSocket (na EC2):     ${WS_URL}"
echo "  Do teu PC (túnel SSH):  ws://127.0.0.1:${OPENCLAW_WS_PORT}"
echo ""
echo "  No PC Windows, no repo OpenClaw:"
echo "    .\\scripts\\claw3d-tunnel.ps1"
echo ""
echo "  Depois abre:"
echo "    - https://www.claw3d.ai/  (Studio → Gateway URL)"
echo "    - ou git clone https://github.com/WW-AI-Lab/openclaw-office"
echo ""
echo "  Painel pixel (só REST, sem WS):"
echo "    \${OPENCLAW_GATEWAY_BASE_URL}/office"
echo ""
echo "  Dashboards comunidade (AgentMonitor, Star Office):"
echo "    ./scripts/install-visual-dashboard.sh agent-monitor"
echo "    ./scripts/install-visual-dashboard.sh star-office"
echo ""
echo "  Documentação: docs/VISUALIZACAO-AGENTES.md · docs/DASHBOARDS-VISUAIS.md"
echo ""
echo "=== Segurança ==="
echo "  - NÃO abras a porta ${OPENCLAW_WS_PORT} no Security Group para 0.0.0.0/0"
echo "  - Usa SSH tunnel ou VPN"
echo ""
