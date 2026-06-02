#!/usr/bin/env node
/**
 * Patch openclaw.json: Groq/Infron/DeepSeek/HF (orchestrator) + Ollama (outros)
 * Uso:
 *   node scripts/ec2-tiered-llm-patch.mjs [/root/.openclaw/openclaw.json]
 *   node scripts/ec2-tiered-llm-patch.mjs --minimal [/root/.openclaw/openclaw.json]
 *
 * --minimal: só agente orchestrator (EC2 enxuta; inovação no HF).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  applyProviderContextWindows,
  ec2BackgroundModel,
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

const argv = process.argv.slice(2);
const minimal = argv.includes('--minimal');
const path =
  argv.find((a) => !a.startsWith('--')) ||
  process.env.OPENCLAW_CONFIG ||
  '/root/.openclaw/openclaw.json';
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
const BACKGROUND = ec2BackgroundModel(runtimeEnv);

if (!ORCH_PRIMARY) {
  console.error('Sem provider cloud (HF_TOKEN/GROQ/etc). Configure /opt/openclaw/.env');
  process.exit(1);
}

function fixModel(entry, primary, fallbacks) {
  entry.model = { primary, fallbacks };
}

if (doc.agents.defaults?.models) delete doc.agents.defaults.models;
fixModel(doc.agents.defaults, ORCH_PRIMARY, []);

if (minimal) {
  let orch = doc.agents.list.find((x) => x.id === 'orchestrator');
  if (!orch) {
    orch = {
      id: 'orchestrator',
      name: 'Jarvis',
      workspace: 'agents/orchestrator',
    };
  }
  fixModel(orch, ORCH_PRIMARY, ORCH_FALLBACKS);
  orch.skills = ['politica-seguranca', 'openclaw-jarvis'];
  doc.agents.list = [orch];
} else {
  for (const entry of doc.agents.list) {
    if (entry.id === 'orchestrator') {
      fixModel(entry, ORCH_PRIMARY, ORCH_FALLBACKS);
      entry.skills = ['politica-seguranca', 'openclaw-jarvis'];
    } else {
      fixModel(entry, BACKGROUND, []);
    }
  }
  const orch = doc.agents.list.find((x) => x.id === 'orchestrator');
  if (orch) {
    doc.agents.list = [orch, ...doc.agents.list.filter((x) => x.id !== 'orchestrator')];
  }
}

doc.tools = doc.tools || {};
doc.tools.profile = 'messaging';
// O perfil "messaging" remove `exec`, mas o Telegram-Jarvis precisa executar
// o hook `scripts/openclaw-jarvis-hook.mjs` localmente.
doc.tools.allow = Array.from(new Set([...(doc.tools.allow || []), 'exec']));

doc.models = doc.models || {};
doc.models.providers = doc.models.providers || {};
delete doc.models.providers.openrouter;
applyProviderContextWindows(doc, runtimeEnv);

doc.agents.defaults.compaction = doc.agents.defaults.compaction || {};
doc.agents.defaults.compaction.reserveTokensFloor = 20000;

if (minimal && doc.plugins?.entries) {
  if (doc.plugins.entries.ollama) doc.plugins.entries.ollama.enabled = false;
  if (doc.plugins.entries.openrouter) doc.plugins.entries.openrouter.enabled = false;
}

writeFileSync(path + '.bak-tiered-llm', readFileSync(path));
writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
if (minimal) {
  console.log('OK minimal EC2: só orchestrator', ORCH_PRIMARY, '->', ORCH_FALLBACKS.join(' -> '));
} else {
  console.log(
    'OK tiered: orchestrator',
    ORCH_PRIMARY,
    '->',
    ORCH_FALLBACKS.join(' -> '),
    '| outros',
    BACKGROUND,
    '| ollama=off'
  );
}
