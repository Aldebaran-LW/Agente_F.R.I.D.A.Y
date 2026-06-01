#!/usr/bin/env node
/**
 * Sincroniza agents/{id}/config.yaml para ~/.openclaw/openclaw.json (modelo por cerebro)
 * Uso:
 *   node scripts/sync-agent-config-to-openclaw.mjs --dry-run
 *   node scripts/sync-agent-config-to-openclaw.mjs --apply
 *   node scripts/sync-agent-config-to-openclaw.mjs --emit-sh   # EC2: bash apply
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { loadAllAgentConfigs, modelRef } from './lib/parse-agent-yaml.mjs';
import { applyProviderContextWindows, orchestratorComplexFallbacks } from './lib/hf-inference-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const p = resolve(process.env.OPENCLAW_ROOT || root, '.env');
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
const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--apply') && !args.has('--emit-sh');
const emitSh = args.has('--emit-sh');
const configPath = process.env.OPENCLAW_CONFIG
  || resolve(homedir(), '.openclaw', 'openclaw.json');

const agents = loadAllAgentConfigs(resolve(root, 'agents'));
if (!agents.length) {
  console.error('Nenhum agents/*/config.yaml encontrado');
  process.exit(1);
}

function fallbackRefs(cfg) {
  if (cfg.id === 'orchestrator') return orchestratorComplexFallbacks();
  return (cfg.fallbacks || []).map((m) => {
    if (m.startsWith('ollama/') || m.startsWith('deepseek/') || m.startsWith('google/') || m.startsWith('huggingface/')) return m;
    if (m.startsWith('openrouter/')) return m.replace(/^openrouter\//, 'ollama/');
    return `ollama/${m}`;
  });
}

const patch = agents.map((a) => ({
  id: a.id,
  name: a.name,
  model: {
    primary: modelRef(a),
    fallbacks: fallbackRefs(a),
  },
  skills: a.skills,
}));

if (!emitSh) {
  console.log('=== Sync agent config -> OpenClaw daemon ===\n');
  for (const p of patch) {
    console.log(`  ${p.id}: primary=${p.model.primary}`);
    if (p.model.fallbacks.length) console.log(`           fallbacks=${p.model.fallbacks.join(', ')}`);
  }
}

if (emitSh) {
  console.log('\n# Cole na EC2 (root) apos git pull:\n');
  console.log('export PATH="/usr/local/bin:$PATH"');
  if (process.env.DEEPSEEK_API_KEY) {
    console.log('openclaw config set models.providers.deepseek.apiKey "$DEEPSEEK_API_KEY" 2>/dev/null || true');
    console.log('openclaw config set models.providers.deepseek.baseUrl "https://api.deepseek.com" 2>/dev/null || true');
  }
  if (process.env.HF_TOKEN || process.env.HUGGINGFACE_HUB_TOKEN) {
    console.log('openclaw config set models.providers.huggingface.apiKey "$HF_TOKEN" 2>/dev/null || true');
    console.log('openclaw config set models.providers.huggingface.baseUrl "https://router.huggingface.co/v1" 2>/dev/null || true');
  }
  for (const p of patch) {
    console.log(`openclaw config set agents.list.${p.id}.model.primary "${p.model.primary}" 2>/dev/null || true`);
    if (p.model.fallbacks.length) {
      console.log(`openclaw config set agents.list.${p.id}.model.fallbacks '${JSON.stringify(p.model.fallbacks)}' 2>/dev/null || true`);
    }
  }
  console.log('systemctl restart openclaw-gateway 2>/dev/null || true');
  process.exit(0);
}

if (!existsSync(configPath)) {
  console.error('\nConfig nao encontrada: ' + configPath);
  console.error('Corra openclaw onboard primeiro ou defina OPENCLAW_CONFIG');
  process.exit(1);
}

const raw = readFileSync(configPath, 'utf8');
const doc = JSON.parse(raw);
doc.agents = doc.agents || {};
doc.agents.list = doc.agents.list || [];

for (const p of patch) {
  let entry = doc.agents.list.find((x) => x.id === p.id);
  if (!entry) {
    entry = { id: p.id, name: p.name || p.id, workspace: `agents/${p.id}`, skills: p.skills || [] };
    doc.agents.list.push(entry);
  }
  entry.model = p.model;
  if (p.skills?.length) entry.skills = p.skills;
}

doc.models = doc.models || {};
doc.models.providers = doc.models.providers || {};
if (doc.models.providers.openrouter) {
  delete doc.models.providers.openrouter;
}
if (process.env.DEEPSEEK_API_KEY) {
  doc.models.providers.deepseek = doc.models.providers.deepseek || {};
  doc.models.providers.deepseek.apiKey = process.env.DEEPSEEK_API_KEY;
  doc.models.providers.deepseek.baseUrl = 'https://api.deepseek.com';
}
if (process.env.GOOGLE_API_KEY) {
  doc.models.providers.google = doc.models.providers.google || {};
  doc.models.providers.google.apiKey = process.env.GOOGLE_API_KEY;
}
applyProviderContextWindows(doc);

if (dryRun) {
  console.log('\n[DRY-RUN] Ficheiro alvo: ' + configPath);
  console.log(JSON.stringify({ agents: { list: doc.agents.list.map((a) => ({ id: a.id, model: a.model })) } }, null, 2));
  console.log('\nAplicar: node scripts/sync-agent-config-to-openclaw.mjs --apply');
  process.exit(0);
}

copyFileSync(configPath, configPath + '.bak-' + Date.now());
writeFileSync(configPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
console.log('\n[OK] Atualizado ' + configPath + ' (backup .bak-* criado)');
console.log('EC2: sudo systemctl restart openclaw-gateway');