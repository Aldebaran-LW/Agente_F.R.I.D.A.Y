#!/usr/bin/env bash
set -euo pipefail
ENV="${OPENCLAW_ENV:-/opt/openclaw/.env}"
if grep -q '^OPENCLAW_LLM_PRIMARY=' "$ENV" 2>/dev/null; then
  sed -i 's/^OPENCLAW_LLM_PRIMARY=.*/OPENCLAW_LLM_PRIMARY=groq/' "$ENV"
else
  echo 'OPENCLAW_LLM_PRIMARY=groq' >> "$ENV"
fi
cd /opt/openclaw
bash scripts/ec2-fix-telegram-models.sh
