#!/usr/bin/env bash
# EC2: Ollama (simples) + DeepSeek (complexo) + gateway (operacional). Sem OpenRouter.
set -euo pipefail
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
cd "${OPENCLAW_ROOT:-/opt/openclaw}"
set -a; source .env 2>/dev/null || true; set +a
export PATH="/usr/local/bin:$PATH"

node scripts/sync-agent-config-to-openclaw.mjs --apply 2>/dev/null || true

node <<'NODE'
const fs = require('fs');
const path = process.env.OPENCLAW_CONFIG || '/root/.openclaw/openclaw.json';
const doc = JSON.parse(fs.readFileSync(path, 'utf8'));
doc.agents = doc.agents || {};
doc.agents.list = doc.agents.list || [];

const SIMPLE = 'ollama/smollm2:360m';
const COMPLEX = 'deepseek/deepseek-v4-flash';

function fixModel(entry, primary, fallbacks) {
  entry.model = { primary, fallbacks };
}

if (doc.agents.defaults?.models) {
  delete doc.agents.defaults.models;
}

fixModel(doc.agents.defaults, SIMPLE, []);

for (const entry of doc.agents.list) {
  if (entry.id === 'orchestrator') {
    fixModel(entry, SIMPLE, [COMPLEX]);
    entry.skills = [
      'politica-seguranca',
      'openclaw-jarvis',
      'github-aldebaran',
      'deploy-monitor',
      'vercel-status',
    ];
  } else {
    fixModel(entry, SIMPLE, []);
  }
}

const orch = doc.agents.list.find((x) => x.id === 'orchestrator');
if (orch) {
  doc.agents.list = [orch, ...doc.agents.list.filter((x) => x.id !== 'orchestrator')];
}

doc.tools = doc.tools || {};
doc.tools.profile = 'messaging';

doc.models = doc.models || {};
doc.models.providers = doc.models.providers || {};
delete doc.models.providers.openrouter;

if (process.env.DEEPSEEK_API_KEY) {
  doc.models.providers.deepseek = doc.models.providers.deepseek || {};
  doc.models.providers.deepseek.apiKey = process.env.DEEPSEEK_API_KEY;
  doc.models.providers.deepseek.baseUrl = 'https://api.deepseek.com';
}

doc.agents.defaults.compaction = doc.agents.defaults.compaction || {};
doc.agents.defaults.compaction.reserveTokensFloor = 20000;

fs.writeFileSync(path + '.bak-tiered-llm', fs.readFileSync(path));
fs.writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
console.log('OK tiered: ollama simple + deepseek complex (orchestrator)');
NODE

WORKSPACE_DIR="$(dirname "$OPENCLAW_CONFIG")/workspace"
SOUL_SRC="/opt/openclaw/agents/_shared/SOUL-TELEGRAM-JARVIS.md"
[[ -f "$SOUL_SRC" ]] && mkdir -p "$WORKSPACE_DIR" && cp "$SOUL_SRC" "$WORKSPACE_DIR/SOUL.md"

if [[ -n "${DEEPSEEK_API_KEY:-}" ]]; then
  openclaw config set models.providers.deepseek.apiKey "$DEEPSEEK_API_KEY" 2>/dev/null || true
  openclaw config set models.providers.deepseek.baseUrl "https://api.deepseek.com" 2>/dev/null || true
fi

openclaw config set agents.list.0.model.primary "ollama/smollm2:360m" 2>/dev/null || true
openclaw config set agents.list.0.model.fallbacks '["deepseek/deepseek-v4-flash"]' 2>/dev/null || true
openclaw config set agents.defaults.compaction.reserveTokensFloor 20000 2>/dev/null || true
openclaw config set tools.profile messaging 2>/dev/null || true

openclaw config validate
systemctl restart openclaw-gateway
sleep 4
systemctl is-active openclaw-gateway
echo "Telegram: /new | simples=Ollama | complexo=DeepSeek | ops=gateway"
