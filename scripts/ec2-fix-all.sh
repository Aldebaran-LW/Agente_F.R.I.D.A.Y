#!/usr/bin/env bash
# ec2-fix-all.sh — limpeza de disco + verificação de serviços na EC2
# Uso: sudo bash /opt/openclaw/scripts/ec2-fix-all.sh
#
# Nota: heimdall_flow no heartbeat falha se office_ok=false (repo GitHub 404, VP_PECAS_URL, etc.)
#       — não é corrigido só com este script. Ver data/heimdall/last-flow.json no gateway.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENCLAW_ROOT="${OPENCLAW_REPO_ROOT:-/opt/openclaw}"
cd "$OPENCLAW_ROOT" 2>/dev/null || cd "$SCRIPT_DIR/.."

echo "==> OpenClaw ec2-fix-all ($(date -u +%Y-%m-%dT%H:%MZ))"
echo "    ROOT=$PWD"

# 1. Limpeza de disco (script canónico)
if [[ -f "$SCRIPT_DIR/ec2-disk-cleanup.sh" ]]; then
  bash "$SCRIPT_DIR/ec2-disk-cleanup.sh" || true
elif [[ -f "$SCRIPT_DIR/ec2-cleanup-disk.sh" ]]; then
  bash "$SCRIPT_DIR/ec2-cleanup-disk.sh" || true
else
  echo "AVISO: ec2-disk-cleanup.sh não encontrado"
fi

USED="$(df / | awk 'NR==2 {print $5}' | tr -d '%')"
if [[ "$USED" -gt 90 ]]; then
  echo "[AVISO] Disco ainda com ${USED}% usado — considere aumentar volume EBS (docs/EC2-DISCO.md)"
else
  echo "[OK] Disco: ${USED}% usado"
fi

# 2. Gateway local
echo ""
echo "==> Gateway HTTP"
GW_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
if curl -sf --max-time 10 "http://127.0.0.1:${GW_PORT}/" >/dev/null 2>&1; then
  echo "[OK] Gateway responde em :${GW_PORT}"
else
  echo "[FALHA] Gateway não responde em :${GW_PORT}"
  systemctl is-active openclaw-gateway 2>/dev/null || true
fi

# 3. Ollama (opcional — só se ainda instalado)
echo ""
echo "==> Ollama (opcional)"
if curl -sf --max-time 5 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "[OK] Ollama local em :11434"
  OLLAMA_MODEL="${OLLAMA_MODEL:-smollm2:360m}"
  curl -sf --max-time 30 http://127.0.0.1:11434/api/chat \
    -H 'Content-Type: application/json' \
    -d "{\"model\":\"${OLLAMA_MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"ok\"}],\"stream\":false}" \
    | head -c 120 || echo "[AVISO] chat Ollama sem resposta útil"
else
  echo "[SKIP] Ollama não activo (normal se stack usa só HF/gateway)"
fi

# 4. Heartbeat
echo ""
echo "==> Heartbeat"
if systemctl is-active openclaw-heartbeat.timer &>/dev/null; then
  systemctl restart openclaw-heartbeat.timer 2>/dev/null || true
  systemctl restart openclaw-heartbeat.service 2>/dev/null || true
  echo "[OK] Timer openclaw-heartbeat reiniciado"
  systemctl status openclaw-heartbeat.timer --no-pager 2>/dev/null | head -5 || true
elif [[ -f "$SCRIPT_DIR/../scripts/heartbeat.py" ]] || [[ -f "$OPENCLAW_ROOT/scripts/heartbeat.py" ]]; then
  HB="$OPENCLAW_ROOT/scripts/heartbeat.py"
  [[ -f "$HB" ]] || HB="$SCRIPT_DIR/heartbeat.py"
  python3 "$HB" 2>/dev/null | tail -1 || true
else
  echo "[SKIP] systemd openclaw-heartbeat não encontrado"
fi

# 5. Lembrete WhatsApp (dry-run)
echo ""
echo "==> Lembretes WhatsApp"
if command -v node &>/dev/null && [[ -f "$OPENCLAW_ROOT/scripts/scheduled-whatsapp-dispatch.mjs" ]]; then
  node "$OPENCLAW_ROOT/scripts/scheduled-whatsapp-dispatch.mjs" --dry-run 2>/dev/null | tail -3 || true
fi

echo ""
echo "==> Concluído. Aguarde ~1 h para o próximo heartbeat ou force: sudo systemctl start openclaw-heartbeat.service"
echo "    Para HF Space 402: bash fix-hf-fallback-ollama.sh no PC ou hf-deploy-space.ps1"
