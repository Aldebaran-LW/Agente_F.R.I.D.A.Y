#!/usr/bin/env bash
# Mostra presença de chaves LLM no .env EC2 (sem valores).
set -euo pipefail
ENV="${1:-/opt/openclaw/.env}"
echo "==> $ENV"
for k in GROQ_API_KEY HF_TOKEN DEEPSEEK_API_KEY INFRON_API_KEY OPENROUTER_API_KEY; do
  if grep -q "^${k}=.\+" "$ENV" 2>/dev/null; then
    echo "  $k=SET"
  elif grep -q "^${k}=" "$ENV" 2>/dev/null; then
    echo "  $k=EMPTY"
  else
    echo "  $k=ABSENT"
  fi
done
OC="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
if [[ -f "$OC" ]]; then
  node -e "
const d=require('$OC');
const o=(d.agents?.list||[]).find(x=>x.id==='orchestrator');
if(o) console.log('orchestrator primary:', o.model?.primary, '\nfallbacks:', (o.model?.fallbacks||[]).join(', '));
"
fi
