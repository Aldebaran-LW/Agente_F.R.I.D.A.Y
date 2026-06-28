#!/usr/bin/env bash
# Testa variáveis EC2 após sync (sem expor secrets).
set -euo pipefail
ENV="${1:-/opt/openclaw/.env}"
cd /opt/openclaw

echo "=== 1. Audit env ==="
if [[ -f scripts/ec2-audit-env.mjs ]]; then
  node scripts/ec2-audit-env.mjs "$ENV"
else
  bash scripts/ec2-check-llm-keys.sh "$ENV"
fi

echo ""
echo "=== 2. GROQ keys presentes ==="
grep -E "^GROQ_" "$ENV" | sed 's/=.*/=***/' || true

read_env() {
  local k="$1"
  grep -m1 "^${k}=" "$ENV" 2>/dev/null | cut -d= -f2- | tr -d '\r'
}

echo ""
echo "=== 3. Teste Groq API ==="
GROQ_API_KEY="$(read_env GROQ_API_KEY)"
GROQ_MODEL="$(read_env GROQ_MODEL)"
OPENCLAW_AUTOMATION_TOKEN="$(read_env OPENCLAW_AUTOMATION_TOKEN)"
OPENCLAW_GATEWAY_BASE_URL="$(read_env OPENCLAW_GATEWAY_BASE_URL)"
code=$(curl -sS -o /tmp/groq-test.json -w "%{http_code}" \
  -H "Authorization: Bearer ${GROQ_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"${GROQ_MODEL:-llama-3.3-70b-versatile}\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"max_tokens\":8}" \
  https://api.groq.com/openai/v1/chat/completions)
echo "HTTP $code"
head -c 220 /tmp/groq-test.json
echo

echo ""
echo "=== 4. Gateway health ==="
gw="${OPENCLAW_GATEWAY_BASE_URL:-https://openclaw.lwdigitalforge.com}"
code2=$(curl -sS -o /tmp/gw-health.json -w "%{http_code}" \
  -H "Authorization: Bearer ${OPENCLAW_AUTOMATION_TOKEN}" \
  "${gw}/api/health")
echo "HTTP $code2"
head -c 300 /tmp/gw-health.json
echo

echo ""
echo "=== 5. Orchestrator model ==="
OC="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
if [[ -f "$OC" ]]; then
  sudo node -e "
const d=require('$OC');
const o=(d.agents?.list||[]).find(x=>x.id==='orchestrator');
if(o) console.log('primary:', o.model?.primary, '| fallbacks:', (o.model?.fallbacks||[]).join(', '));
else console.log('orchestrator not found');
"
else
  echo "openclaw.json not found at $OC"
fi

echo ""
echo "=== 6. Patch minimal + restart ==="
sudo node scripts/ec2-tiered-llm-patch.mjs --minimal
sudo systemctl restart openclaw-gateway
sleep 2
sudo systemctl is-active openclaw-gateway
