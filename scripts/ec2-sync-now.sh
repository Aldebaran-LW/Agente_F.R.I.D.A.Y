#!/usr/bin/env bash
# EC2 — sincronizar repo + Jarvis PT + gateway Vercel + heartbeat/Heimdall
# Uso na EC2: sudo bash scripts/ec2-sync-now.sh
# Do PC:     .\scripts\ec2-sync-from-pc.ps1
set -euo pipefail

echo "==> OpenClaw ec2-sync-now $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# --- localizar repo ---
OPENCLAW_ROOT=""
for d in /opt/openclaw /opt/openclaw/Agente_OpenClaw "$HOME/Agente_OpenClaw"; do
  if [[ -d "$d/.git" ]]; then
    OPENCLAW_ROOT="$d"
    break
  fi
done
if [[ -z "$OPENCLAW_ROOT" ]]; then
  echo "ERRO: repo nao encontrado (/opt/openclaw ou ~/Agente_OpenClaw)"
  exit 1
fi
cd "$OPENCLAW_ROOT"
export OPENCLAW_ROOT
export PATH="/usr/local/bin:$PATH"
export OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"

echo "==> Repo: $OPENCLAW_ROOT"

# --- disco (heartbeat CRITICO se <10% livre) ---
if [[ -f scripts/ec2-disk-cleanup.sh ]]; then
  echo "==> ec2-disk-cleanup"
  bash scripts/ec2-disk-cleanup.sh || echo "AVISO: cleanup disco incompleto"
fi

# --- git ---
if [[ -d .git ]]; then
  git fetch origin main 2>/dev/null || git fetch origin 2>/dev/null || true
  git pull --ff-only origin main 2>/dev/null || git pull --ff-only 2>/dev/null || {
    echo "AVISO: git pull falhou — continua com codigo local"
  }
  echo "HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo '?') $(git log -1 --oneline 2>/dev/null || true)"
fi

# --- .env minimo ---
if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

ensure_env() {
  local key="$1" val="$2"
  if [[ -f .env ]] && grep -q "^${key}=" .env 2>/dev/null; then
    return 0
  fi
  echo "${key}=${val}" >> .env
  echo "  + .env ${key}"
}

ensure_env "OPENCLAW_GATEWAY_BASE_URL" "https://openclaw.lwdigitalforge.com"
ensure_env "HEARTBEAT_CHECK_HEIMDALL_FLOW" "1"
ensure_env "HEARTBEAT_AGENT_STALE_MIN" "60"

if [[ -z "${OPENCLAW_AUTOMATION_TOKEN:-}" ]]; then
  echo ""
  echo "AVISO: OPENCLAW_AUTOMATION_TOKEN em falta no .env da EC2"
  echo "  Copia o mesmo valor do PC (.env) para operacao via gateway (Jarvis PT)."
  echo ""
fi

# --- agentes + SOUL Jarvis PT ---
if [[ -x scripts/ec2-apply-agent-config.sh ]]; then
  echo "==> ec2-apply-agent-config"
  bash scripts/ec2-apply-agent-config.sh
elif [[ -f scripts/sync-agent-config-to-openclaw.mjs ]]; then
  node scripts/sync-agent-config-to-openclaw.mjs --apply
fi

# --- Telegram: modelos + gateway (sem OpenRouter se script existir) ---
if [[ -f scripts/ec2-fix-telegram-models.sh ]]; then
  echo "==> ec2-fix-telegram-models"
  bash scripts/ec2-fix-telegram-models.sh
else
  echo "==> restart gateway (sem ec2-fix-telegram-models.sh)"
  systemctl restart openclaw-gateway 2>/dev/null || true
fi

# --- heartbeat timer ---
if [[ -f scripts/systemd/openclaw-heartbeat.service ]]; then
  cp -f scripts/systemd/openclaw-heartbeat.service /etc/systemd/system/ 2>/dev/null || \
    sudo cp -f scripts/systemd/openclaw-heartbeat.service /etc/systemd/system/
  cp -f scripts/systemd/openclaw-heartbeat.timer /etc/systemd/system/ 2>/dev/null || \
    sudo cp -f scripts/systemd/openclaw-heartbeat.timer /etc/systemd/system/
  systemctl daemon-reload 2>/dev/null || sudo systemctl daemon-reload
  systemctl enable --now openclaw-heartbeat.timer 2>/dev/null || \
    sudo systemctl enable --now openclaw-heartbeat.timer 2>/dev/null || true
fi

# --- testes locais ---
echo "==> Testes"
if command -v node >/dev/null && [[ -f scripts/heimdall-flow-monitor.mjs ]]; then
  node scripts/heimdall-flow-monitor.mjs --json 2>/dev/null | head -c 400 || echo "  heimdall-flow: skip"
  echo ""
fi

GW="${OPENCLAW_GATEWAY_BASE_URL:-https://openclaw.lwdigitalforge.com}"
if command -v curl >/dev/null; then
  HEALTH="$(curl -sS -m 15 "${GW}/api/health" 2>/dev/null || echo '{}')"
  echo "  gateway health: $HEALTH"
  if [[ -n "${OPENCLAW_AUTOMATION_TOKEN:-}" ]]; then
    CODE="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' \
      -H "Authorization: Bearer ${OPENCLAW_AUTOMATION_TOKEN}" \
      "${GW}/openclaw/innovation/status" 2>/dev/null || echo 0)"
    echo "  innovation/status: HTTP $CODE (200=ok, 401=token invalido)"
  fi
fi

echo ""
echo "==> Servicos"
for u in openclaw-gateway openclaw-heartbeat.timer; do
  systemctl is-active "$u" 2>/dev/null && echo "  $u: active" || echo "  $u: (nao activo)"
done

echo ""
echo "OK ec2-sync-now"
echo "Telegram: envia 'ajuda' ou 'resumo portfolio' ao @LW_Acessor_bot"
echo "Logs:     sudo journalctl -u openclaw-gateway -f"
