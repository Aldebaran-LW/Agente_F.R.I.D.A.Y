#!/usr/bin/env bash
# Deploy todos os Workers Cloudflare (router + agentes)
# Uso: bash workers/deploy.sh [staging|production]
set -euo pipefail

MODE="${1:-staging}"
WORKERS_DIR="$(cd "$(dirname "$0")" && pwd)"
CF_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-1b1e73eec84696014b5812225fd026e0}"

echo "=== Deploy OpenClaw Workers ($MODE) ==="

deploy_worker() {
  local dir="$1"
  local name="$2"
  echo ""
  echo "--> $name ($dir)"
  cd "$WORKERS_DIR/$dir"
  if [[ "$MODE" == "production" ]]; then
    npx wrangler deploy --env production
  else
    npx wrangler deploy --env staging
  fi
}

deploy_worker "router" "Router"
deploy_worker "macofel" "Macofel"
deploy_worker "jarvis" "Jarvis"
deploy_worker "heimdall" "Heimdall"
deploy_worker "innovation" "Innovation"

echo ""
echo "=== Deploy concluido ($MODE) ==="
echo "Router: https://openclaw-router${MODE}.lwdigitalforge.workers.dev"
echo "Health: curl https://openclaw-router${MODE}.lwdigitalforge.workers.dev/health"
