#!/usr/bin/env bash
# Define VP_PECAS_URL no /opt/openclaw/.env (EC2) de forma idempotente.
# Uso:
#   sudo bash /opt/openclaw/scripts/ec2-set-vp-pecas-url.sh https://vp-pecas.vercel.app
set -euo pipefail

ENV_FILE="${OPENCLAW_ENV_FILE:-/opt/openclaw/.env}"
URL="${1:-https://vp-pecas.vercel.app}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: .env não encontrado em $ENV_FILE"
  exit 1
fi

if grep -qE '^\s*VP_PECAS_URL=' "$ENV_FILE"; then
  sed -i "s|^\s*VP_PECAS_URL=.*|VP_PECAS_URL=${URL}|g" "$ENV_FILE"
else
  printf "\nVP_PECAS_URL=%s\n" "$URL" >>"$ENV_FILE"
fi

echo "[OK] VP_PECAS_URL aplicado em $ENV_FILE"
