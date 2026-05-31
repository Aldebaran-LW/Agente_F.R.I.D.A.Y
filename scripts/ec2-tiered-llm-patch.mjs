#!/usr/bin/env node
/**
 * Patch openclaw.json: Ollama simples + DeepSeek/HF complexo (orchestrator)
 * Uso: node scripts/ec2-tiered-llm-patch.mjs [/root/.openclaw/openclaw.json]
 */
import { readFileSync, writeFileSync } from 'fs';
import {
  applyGroqProvider,
  applyHfProvider,
  applyInfronProvider,
  orchestratorComplexFallbacks,
} from './lib/hf-inference-config.mjs';

const path = process.argv[2] || process.env.OPENCLAW_CONFIG || '/root/.openclaw/openclaw.json';
const doc = JSON.parse(readFileSync(path, 'utf8'));
doc.agents = doc.agents || {};
doc.agents.list = doc.agents.list || [];

const SIMPLE = 'ollama/smollm2:360m';
const COMPLEX_FALLBACKS = orchestratorComplexFallbacks();

function fixModel(entry, primary, fallbacks) {
  entry.model = { primary, fallbacks };
}

if (doc.agents.defaults?.models) delete doc.agents.defaults.models;
fixModel(doc.agents.defaults, SIMPLE, []);

for (const entry of doc.agents.list) {
  if (entry.id === 'orchestrator') {
    fixModel(entry, SIMPLE, COMPLEX_FALLBACKS);
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
applyHfProvider(doc);
applyInfronProvider(doc);
applyGroqProvider(doc);

doc.agents.defaults.compaction = doc.agents.defaults.compaction || {};
doc.agents.defaults.compaction.reserveTokensFloor = 20000;

writeFileSync(path + '.bak-tiered-llm', readFileSync(path));
writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
console.log('OK tiered:', SIMPLE, '->', COMPLEX_FALLBACKS.join(' -> '));