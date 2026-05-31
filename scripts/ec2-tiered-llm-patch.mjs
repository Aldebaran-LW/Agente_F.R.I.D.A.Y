#!/usr/bin/env node
/**
 * Patch openclaw.json: Groq/Infron/DeepSeek/HF (orchestrator) + Ollama (outros)
 * Uso: node scripts/ec2-tiered-llm-patch.mjs [/root/.openclaw/openclaw.json]
 */
import { readFileSync, writeFileSync } from 'fs';
import {
  applyProviderContextWindows,
  OLLAMA_SIMPLE_MODEL,
  orchestratorComplexFallbacks,
  orchestratorPrimaryModel,
} from './lib/hf-inference-config.mjs';

const path = process.argv[2] || process.env.OPENCLAW_CONFIG || '/root/.openclaw/openclaw.json';
const doc = JSON.parse(readFileSync(path, 'utf8'));
doc.agents = doc.agents || {};
doc.agents.list = doc.agents.list || [];

const ORCH_PRIMARY = orchestratorPrimaryModel();
const ORCH_FALLBACKS = orchestratorComplexFallbacks();

function fixModel(entry, primary, fallbacks) {
  entry.model = { primary, fallbacks };
}

if (doc.agents.defaults?.models) delete doc.agents.defaults.models;
fixModel(doc.agents.defaults, ORCH_PRIMARY, []);

for (const entry of doc.agents.list) {
  if (entry.id === 'orchestrator') {
    fixModel(entry, ORCH_PRIMARY, ORCH_FALLBACKS);
    entry.skills = ['politica-seguranca', 'openclaw-jarvis'];
  } else {
    fixModel(entry, OLLAMA_SIMPLE_MODEL, []);
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
applyProviderContextWindows(doc);

doc.agents.defaults.compaction = doc.agents.defaults.compaction || {};
doc.agents.defaults.compaction.reserveTokensFloor = 20000;

writeFileSync(path + '.bak-tiered-llm', readFileSync(path));
writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
console.log('OK tiered: orchestrator', ORCH_PRIMARY, '->', ORCH_FALLBACKS.join(' -> '), '| outros', OLLAMA_SIMPLE_MODEL);
