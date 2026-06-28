#!/usr/bin/env bash
# Telegram: contexto >12k no Groq free + fallbacks sem credito.
# - modelo Groq menor (8b)
# - reactiva HF Inference como fallback
# - limpa sessoes por completo
set -euo pipefail
OPENCLAW_ROOT="${OPENCLAW_ROOT:-/opt/openclaw}"
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
cd "$OPENCLAW_ROOT"

touch .env
# Groq 70b estoura TPM 12k com prompt Jarvis; 8b aguenta melhor.
grep -q '^GROQ_MODEL=' .env && \
  sed -i 's/^GROQ_MODEL=.*/GROQ_MODEL=llama-3.1-8b-instant/' .env || \
  echo 'GROQ_MODEL=llama-3.1-8b-instant' >> .env
grep -q '^OPENCLAW_LLM_PRIMARY=' .env && \
  sed -i 's/^OPENCLAW_LLM_PRIMARY=.*/OPENCLAW_LLM_PRIMARY=groq/' .env || \
  echo 'OPENCLAW_LLM_PRIMARY=groq' >> .env
# HF como fallback quando Groq falha (Infron/DeepSeek sem creditos).
sed -i '/^OPENCLAW_SKIP_HF_INFERENCE=/d' .env
echo 'OPENCLAW_SKIP_HF_INFERENCE=0' >> .env

echo "==> env (sem secrets)"
grep -E '^(OPENCLAW_LLM_PRIMARY|GROQ_MODEL|OPENCLAW_SKIP_HF)=' .env | sed 's/=.*/=***/'

echo "==> patch LLM minimal + HF fallback"
node scripts/ec2-tiered-llm-patch.mjs --minimal "$OPENCLAW_CONFIG"

node -e "
const d=JSON.parse(require('fs').readFileSync('$OPENCLAW_CONFIG','utf8'));
const o=d.agents?.list?.find(x=>x.id==='orchestrator');
console.log('orchestrator:', o?.model?.primary, '->', (o?.model?.fallbacks||[]).join(' -> '));
"

echo "==> test groq 8b"
node scripts/test-groq.mjs || true

echo "==> test HF inference"
node scripts/test-hf-inference.mjs || true

echo "==> limpar sessoes (incl. sessions.json)"
SESS_DIR="$(dirname "$OPENCLAW_CONFIG")/agents/orchestrator/sessions"
rm -rf "${SESS_DIR:?}/"* 2>/dev/null || true
mkdir -p "$SESS_DIR"

openclaw config set agents.defaults.compaction.mode summarize 2>/dev/null || true
openclaw config set agents.defaults.compaction.reserveTokensFloor 8000 2>/dev/null || true

systemctl restart openclaw-gateway
sleep 4
systemctl is-active openclaw-gateway
echo "OK — Telegram: /new depois Oi"
