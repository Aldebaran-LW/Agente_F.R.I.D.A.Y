#!/usr/bin/env node
/**
 * Patch openclaw.json: Groq/Infron/DeepSeek/HF (orchestrator) + Ollama (outros)
 * Uso: node scripts/ec2-tiered-llm-patch.mjs [/root/.openclaw/openclaw.json]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  applyProviderContextWindows,
  OLLAMA_SIMPLE_MODEL,
  orchestratorComplexFallbacks,
  orchestratorPrimaryModel,
} from './lib/hf-inference-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const root = process.env.OPENCLAW_ROOT || resolve(__dirname, '..');
  const p = resolve(root, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}

loadEnv();

const path = process.argv[2] || process.env.OPENCLAW_CONFIG || '/root/.openclaw/openclaw.json';
const doc = JSON.parse(readFileSync(path, 'utf8'));
doc.agents = doc.agents || {};
doc.agents.list = doc.agents.list || [];

/** Chaves já em openclaw.json (onboard) quando .env EC2 ausente */
function envFromDoc(baseDoc) {
  const env = { ...process.env };
  const p = baseDoc.models?.providers || {};
  if (!env.GROQ_API_KEY?.trim() && p.groq?.apiKey) env.GROQ_API_KEY = p.groq.apiKey;
  if (!env.DEEPSEEK_API_KEY?.trim() && p.deepseek?.apiKey) env.DEEPSEEK_API_KEY = p.deepseek.apiKey;
  if (!env.HF_TOKEN?.trim() && p.huggingface?.apiKey) env.HF_TOKEN = p.huggingface.apiKey;
  if (!env.INFRON_API_KEY?.trim() && p.infron?.apiKey) env.INFRON_API_KEY = p.infron.apiKey;
  return env;
}

const runtimeEnv = envFromDoc(doc);
const ORCH_PRIMARY = orchestratorPrimaryModel(runtimeEnv);
const ORCH_FALLBACKS = orchestratorComplexFallbacks(runtimeEnv);

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
applyProviderContextWindows(doc, runtimeEnv);

doc.agents.defaults.compaction = doc.agents.defaults.compaction || {};
doc.agents.defaults.compaction.reserveTokensFloor = 20000;

writeFileSync(path + '.bak-tiered-llm', readFileSync(path));
writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
console.log('OK tiered: orchestrator', ORCH_PRIMARY, '->', ORCH_FALLBACKS.join(' -> '), '| outros', OLLAMA_SIMPLE_MODEL);
