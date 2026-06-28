#!/usr/bin/env bash
set -euo pipefail
cd /opt/openclaw
set -a; source .env 2>/dev/null || true; set +a

echo "=== orchestrator model ==="
node -e "
const d=JSON.parse(require('fs').readFileSync('/root/.openclaw/openclaw.json','utf8'));
const o=d.agents?.list?.find(x=>x.id==='orchestrator');
console.log('orchestrator:', JSON.stringify(o?.model,null,2));
console.log('defaults:', JSON.stringify(d.agents?.defaults?.model,null,2));
"

echo "=== env keys (set?) ==="
for k in GROQ_API_KEY DEEPSEEK_API_KEY HF_TOKEN INFRON_API_KEY OPENAI_API_KEY OPENCLAW_LLM_PRIMARY; do
  v=$(grep -E "^${k}=" .env 2>/dev/null | cut -d= -f2- || true)
  if [ -n "$v" ]; then echo "$k=SET(len ${#v})"; else echo "$k=MISSING"; fi
done

echo "=== providers in openclaw.json ==="
node -e "
const d=JSON.parse(require('fs').readFileSync('/root/.openclaw/openclaw.json','utf8'));
const p=d.models?.providers||{};
for (const [k,v] of Object.entries(p)) {
  const key=v?.apiKey?'SET('+v.apiKey.length+')':'no';
  console.log(k, key);
}
"

echo "=== test groq ==="
node scripts/test-groq.mjs || true

echo "=== gateway status ==="
systemctl is-active openclaw-gateway || true

echo "=== recent errors (gateway journal) ==="
journalctl -u openclaw-gateway --no-pager -n 100 2>/dev/null | grep -iE 'billing|402|groq|openai|credit|insufficient|fail|error' | tail -25 || true

echo "=== openclaw log tail ==="
LOG=$(ls -t /tmp/openclaw/openclaw-*.log /root/.openclaw/logs/*.log 2>/dev/null | head -1)
if [ -n "${LOG:-}" ]; then
  echo "file: $LOG"
  tail -40 "$LOG" | grep -iE 'billing|402|groq|openai|credit|insufficient|model|provider|fail|error' || tail -15 "$LOG"
fi
