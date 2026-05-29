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

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
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
  return (cfg.fallbacks || []).map((m) => {
    if (m.startsWith('openrouter/') || m.startsWith('ollama/') || m.startsWith('google/')) return m;
    if (m.startsWith('ollama/')) return m;
    return `openrouter/${m}`;
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
  if (process.env.OPENROUTER_API_KEY) {
    console.log('openclaw config set models.providers.openrouter.apiKey "$OPENROUTER_API_KEY" 2>/dev/null || true');
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