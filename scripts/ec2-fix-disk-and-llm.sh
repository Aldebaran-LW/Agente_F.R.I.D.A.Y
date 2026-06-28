#!/usr/bin/env bash
# Disco + Groq primary + restart (sem expor secrets)
set -euo pipefail
OPENCLAW_ROOT="${OPENCLAW_ROOT:-/opt/openclaw}"
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
cd "$OPENCLAW_ROOT"

echo "==> 1. Disco antes"
df -h /

echo ""
echo "==> 2. Cleanup disco"
if [[ -f scripts/ec2-disk-cleanup.sh ]]; then
  bash scripts/ec2-disk-cleanup.sh || true
fi

echo ""
echo "==> 3. Garantir OPENCLAW_LLM_PRIMARY=groq"
touch .env
grep -q '^OPENCLAW_LLM_PRIMARY=' .env && \
  sed -i 's/^OPENCLAW_LLM_PRIMARY=.*/OPENCLAW_LLM_PRIMARY=groq/' .env || \
  echo 'OPENCLAW_LLM_PRIMARY=groq' >> .env
grep -q '^GROQ_MODEL=' .env && \
  sed -i 's/^GROQ_MODEL=.*/GROQ_MODEL=llama-3.1-8b-instant/' .env || \
  echo 'GROQ_MODEL=llama-3.1-8b-instant' >> .env
# Footer com · quebra source systemd
sed -i 's/^TWILIO_WHATSAPP_FOOTER=.*/TWILIO_WHATSAPP_FOOTER=OpenClaw-Aldebaran-LW/' .env 2>/dev/null || true

grep -E '^(OPENCLAW_LLM_PRIMARY|GROQ_MODEL)=' .env | sed 's/=.*/=***/'

echo ""
echo "==> 4. Patch LLM minimal"
node scripts/ec2-tiered-llm-patch.mjs --minimal "$OPENCLAW_CONFIG"

echo ""
echo "==> 5. Modelo orchestrator"
node -e "
const d=require('$OPENCLAW_CONFIG');
const o=(d.agents?.list||[]).find(x=>x.id==='orchestrator');
console.log('primary:', o?.model?.primary);
console.log('fallbacks:', (o?.model?.fallbacks||[]).join(' -> '));
"

echo ""
echo "==> 6. Compaction agressiva (evita prompt >12k no Groq free)"
openclaw config set agents.defaults.compaction.reserveTokensFloor 24000 2>/dev/null || true
openclaw config set agents.defaults.compaction.mode summarize 2>/dev/null || true

echo ""
echo "==> 7. Limpar sessões antigas (força modelo novo)"
CLEAR_SESSIONS_NO_RESTART=1 bash scripts/ec2-clear-sessions.sh 2>/dev/null || true
find "$(dirname "$OPENCLAW_CONFIG")/agents" -path '*/sessions/*.jsonl' -delete 2>/dev/null || true

echo ""
echo "==> 8. Restart gateway"
systemctl restart openclaw-gateway
sleep 3
systemctl is-active openclaw-gateway

echo ""
echo "==> 9. Disco depois"
df -h / | tail -1

echo ""
echo "OK — envia /new no Telegram e testa Oi"
