#!/usr/bin/env bash
# Configura secrets para todos os Workers Cloudflare
# Uso: bash workers/set-secrets.sh [staging|production]
set -euo pipefail

MODE="${1:-staging}"
ENV_FLAG=""
[[ "$MODE" == "production" ]] && ENV_FLAG="--env production"

echo "=== Configurando secrets Workers ($MODE) ==="

put_secret() {
  local worker="$1" name="$2" value="$3"
  if [[ -z "$value" ]]; then
    echo "  [SKIP] $worker:$name (vazio)"
    return
  fi
  echo "$value" | npx wrangler secret put "$name" $ENV_FLAG --name "$worker" 2>/dev/null && \
    echo "  [OK] $worker:$name" || \
    echo "  [FAIL] $worker:$name"
}

# Router
put_secret "openclaw-router" "OPENCLAW_AUTOMATION_TOKEN" "${OPENCLAW_AUTOMATION_TOKEN:-}"

# Macofel
put_secret "openclaw-macofel" "MONGODB_URI" "${MONGODB_URI:-}"
put_secret "openclaw-macofel" "MONGODB_DB_NAME" "${MONGODB_DB_NAME:-macofel}"
put_secret "openclaw-macofel" "MACOFEL_API_BASE" "${MACOFEL_API_BASE:-}"
put_secret "openclaw-macofel" "OPENCLAW_AUTOMATION_TOKEN" "${OPENCLAW_AUTOMATION_TOKEN:-}"
put_secret "openclaw-macofel" "OPENCLAW_GATEWAY_BASE_URL" "${OPENCLAW_GATEWAY_BASE_URL:-}"

# Jarvis
put_secret "openclaw-jarvis" "GROQ_API_KEY" "${GROQ_API_KEY:-}"
put_secret "openclaw-jarvis" "DEEPSEEK_API_KEY" "${DEEPSEEK_API_KEY:-}"
put_secret "openclaw-jarvis" "OPENROUTER_API_KEY" "${OPENROUTER_API_KEY:-}"
put_secret "openclaw-jarvis" "HF_TOKEN" "${HF_TOKEN:-}"
put_secret "openclaw-jarvis" "TELEGRAM_BOT_TOKEN" "${TELEGRAM_BOT_TOKEN:-}"
put_secret "openclaw-jarvis" "TELEGRAM_ADMIN_CHAT_ID" "${TELEGRAM_ADMIN_CHAT_ID:-}"
put_secret "openclaw-jarvis" "OPENCLAW_AUTOMATION_TOKEN" "${OPENCLAW_AUTOMATION_TOKEN:-}"

# Heimdall
put_secret "openclaw-heimdall" "GITHUB_TOKEN" "${GITHUB_TOKEN:-}"
put_secret "openclaw-heimdall" "VERCEL_API_TOKEN" "${VERCEL_API_TOKEN:-}"
put_secret "openclaw-heimdall" "VP_PECAS_URL" "${VP_PECAS_URL:-}"
put_secret "openclaw-heimdall" "VP_PRECISION_URL" "${VP_PRECISION_URL:-}"
put_secret "openclaw-heimdall" "OPENCLAW_AUTOMATION_TOKEN" "${OPENCLAW_AUTOMATION_TOKEN:-}"

# Innovation
put_secret "openclaw-innovation" "OPENROUTER_API_KEY" "${OPENROUTER_API_KEY:-}"
put_secret "openclaw-innovation" "DEEPSEEK_API_KEY" "${DEEPSEEK_API_KEY:-}"
put_secret "openclaw-innovation" "GROQ_API_KEY" "${GROQ_API_KEY:-}"
put_secret "openclaw-innovation" "OPENCLAW_AUTOMATION_TOKEN" "${OPENCLAW_AUTOMATION_TOKEN:-}"

echo ""
echo "=== Secrets configurados ($MODE) ==="
