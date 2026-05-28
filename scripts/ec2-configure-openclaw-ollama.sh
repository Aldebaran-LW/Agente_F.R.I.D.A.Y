#!/usr/bin/env bash
# Configurar OpenClaw para usar Ollama local. Executar na EC2 como root.
set -euo pipefail

MODEL="${OLLAMA_MODEL:-smollm2:360m}"
ENV_FILE="${OPENCLAW_ENV:-/opt/openclaw/.env}"

if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null; then
  echo "ERRO: Ollama não responde em :11434. Corra ec2-install-ollama.sh primeiro."
  exit 1
fi

grep -q '^OLLAMA_API_KEY=' "$ENV_FILE" 2>/dev/null \
  && sed -i 's/^OLLAMA_API_KEY=.*/OLLAMA_API_KEY=ollama-local/' "$ENV_FILE" \
  || echo 'OLLAMA_API_KEY=ollama-local' >>"$ENV_FILE"

export PATH="/usr/local/bin:$PATH"
openclaw config set models.providers.ollama.apiKey "ollama-local" 2>/dev/null || true
openclaw config set agents.defaults.model.primary "ollama/${MODEL}" 2>/dev/null || true

# Fallback Gemini Flash (cota free) só se Ollama falhar
openclaw config set agents.defaults.model.fallbacks '["google/gemini-2.0-flash"]' 2>/dev/null || true

systemctl restart openclaw-gateway
sleep 2
systemctl is-active openclaw-gateway

echo "OK primary=ollama/${MODEL}"
