#!/usr/bin/env bash
# EC2: Ollama (simples) + DeepSeek/HF Router (complexo) + gateway (operacional). Sem OpenRouter.
set -euo pipefail
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
cd "${OPENCLAW_ROOT:-/opt/openclaw}"
set -a; source .env 2>/dev/null || true; set +a
export PATH="/usr/local/bin:$PATH"

node scripts/sync-agent-config-to-openclaw.mjs --apply 2>/dev/null || true

node scripts/ec2-tiered-llm-patch.mjs "$OPENCLAW_CONFIG"

WORKSPACE_DIR="$(dirname "$OPENCLAW_CONFIG")/workspace"
SOUL_SRC="/opt/openclaw/agents/_shared/SOUL-TELEGRAM-JARVIS.md"
[[ -f "$SOUL_SRC" ]] && mkdir -p "$WORKSPACE_DIR" && cp "$SOUL_SRC" "$WORKSPACE_DIR/SOUL.md"

if [[ -n "${DEEPSEEK_API_KEY:-}" ]]; then
  openclaw config set models.providers.deepseek.apiKey "$DEEPSEEK_API_KEY" 2>/dev/null || true
  openclaw config set models.providers.deepseek.baseUrl "https://api.deepseek.com" 2>/dev/null || true
fi

HF_KEY="${HF_TOKEN:-${HUGGINGFACE_HUB_TOKEN:-}}"
if [[ -n "$HF_KEY" ]]; then
  openclaw config set models.providers.huggingface.apiKey "$HF_KEY" 2>/dev/null || true
  openclaw config set models.providers.huggingface.baseUrl "https://router.huggingface.co/v1" 2>/dev/null || true
fi

if [[ -n "${INFRON_API_KEY:-}" ]]; then
  INFRON_URL="${INFRON_BASE_URL:-https://llm.onerouter.pro/v1}"
  openclaw config set models.providers.infron.apiKey "$INFRON_API_KEY" 2>/dev/null || true
  openclaw config set models.providers.infron.baseUrl "$INFRON_URL" 2>/dev/null || true
fi

if [[ -n "${GROQ_API_KEY:-}" ]]; then
  GROQ_URL="${GROQ_BASE_URL:-https://api.groq.com/openai/v1}"
  openclaw config set models.providers.groq.apiKey "$GROQ_API_KEY" 2>/dev/null || true
  openclaw config set models.providers.groq.baseUrl "$GROQ_URL" 2>/dev/null || true
fi

FALLBACKS='["deepseek/deepseek-v4-flash"]'
if [[ -n "$HF_KEY" ]]; then
  HF_MODEL="${HF_INFERENCE_MODEL:-Qwen/Qwen2.5-7B-Instruct:fastest}"
  HF_MODEL="${HF_MODEL#huggingface/}"
  FALLBACKS='["deepseek/deepseek-v4-flash","huggingface/'"$HF_MODEL"'"]'
fi
if [[ -n "${INFRON_API_KEY:-}" ]]; then
  INFRON_MODEL="${INFRON_MODEL:-deepseek/deepseek-v3.2}"
  INFRON_MODEL="${INFRON_MODEL#infron/}"
  if [[ -n "$HF_KEY" ]]; then
    FALLBACKS='["deepseek/deepseek-v4-flash","huggingface/'"$HF_MODEL"'","infron/'"$INFRON_MODEL"'"]'
  else
    FALLBACKS='["deepseek/deepseek-v4-flash","infron/'"$INFRON_MODEL"'"]'
  fi
fi
if [[ -n "${GROQ_API_KEY:-}" ]]; then
  GROQ_MODEL="${GROQ_MODEL:-llama-3.3-70b-versatile}"
  GROQ_MODEL="${GROQ_MODEL#groq/}"
  FALLBACKS="${FALLBACKS%\]},\"groq/${GROQ_MODEL}\"]"
fi

openclaw config set agents.list.0.model.primary "ollama/smollm2:360m" 2>/dev/null || true
openclaw config set agents.list.0.model.fallbacks "$FALLBACKS" 2>/dev/null || true
openclaw config set agents.defaults.compaction.reserveTokensFloor 20000 2>/dev/null || true
openclaw config set tools.profile messaging 2>/dev/null || true

openclaw config validate

CLEAR_SESSIONS_NO_RESTART=1 bash scripts/ec2-clear-sessions.sh 2>/dev/null || true

systemctl restart openclaw-gateway
sleep 4
systemctl is-active openclaw-gateway
echo "Telegram: /new | simples=Ollama | complexo=DeepSeek→HF→Infron→Groq | ops=gateway"
