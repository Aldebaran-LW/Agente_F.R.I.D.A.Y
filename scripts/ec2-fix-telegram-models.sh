#!/usr/bin/env bash
# EC2: remover Gemini 429 e fallbacks invalidos (sem alterar bindings)
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

function fixModel(entry, primary, fallbacks) {
  entry.model = { primary, fallbacks };
}

// Remover override Gemini pago/quota esgotada
if (doc.agents.defaults?.models) {
  delete doc.agents.defaults.models['google/gemini-3.1-pro-preview'];
  if (Object.keys(doc.agents.defaults.models).length === 0) {
    delete doc.agents.defaults.models;
  }
}

fixModel(doc.agents.defaults, 'openrouter/deepseek/deepseek-v4-flash:free', [
  'openrouter/minimax/minimax-m2.5:free',
  'openrouter/openai/gpt-oss-20b:free',
]);

for (const entry of doc.agents.list) {
  if (!entry.model?.fallbacks) continue;
  entry.model.fallbacks = entry.model.fallbacks.map((m) => {
    if (m.startsWith('openrouter/') || m.startsWith('ollama/')) return m;
    if (m.includes(':free')) return `openrouter/${m.replace(/^openrouter\//, '')}`;
    if (m === 'google/gemini-2.0-flash') return 'openrouter/google/gemini-2.0-flash-exp:free';
    return m;
  });
  if (entry.id === 'macofel') {
    fixModel(entry, 'openrouter/google/gemma-4-26b-a4b-it:free', [
      'openrouter/deepseek/deepseek-v4-flash:free',
      'openrouter/minimax/minimax-m2.5:free',
    ]);
  }
  if (entry.id === 'orchestrator') {
    fixModel(entry, 'openrouter/deepseek/deepseek-v4-flash:free', [
      'openrouter/minimax/minimax-m2.5:free',
      'openrouter/openai/gpt-oss-20b:free',
      'openrouter/google/gemma-4-26b-a4b-it:free',
    ]);
    entry.skills = [
      'politica-seguranca',
      'openclaw-jarvis',
      'github-aldebaran',
      'deploy-monitor',
      'vercel-status',
    ];
  }
}

// orchestrator primeiro na lista (default implicito)
const orch = doc.agents.list.find((x) => x.id === 'orchestrator');
if (orch) {
  doc.agents.list = [orch, ...doc.agents.list.filter((x) => x.id !== 'orchestrator')];
}

fs.writeFileSync(path + '.bak-models-fix', fs.readFileSync(path));
fs.writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
console.log('OK models fix (sem bindings)');
NODE

WORKSPACE_DIR="$(dirname "$OPENCLAW_CONFIG")/workspace"
SOUL_SRC="/opt/openclaw/agents/_shared/SOUL-TELEGRAM-JARVIS.md"
[[ -f "$SOUL_SRC" ]] && mkdir -p "$WORKSPACE_DIR" && cp "$SOUL_SRC" "$WORKSPACE_DIR/SOUL.md"

if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  openclaw config set models.providers.openrouter.apiKey "$OPENROUTER_API_KEY" 2>/dev/null || true
fi

openclaw config validate
systemctl restart openclaw-gateway
sleep 4
systemctl is-active openclaw-gateway
echo "Telegram: /new depois ajuda"
