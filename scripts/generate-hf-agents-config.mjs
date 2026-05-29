#!/usr/bin/env node
/**
 * Gera hf-space/friday-prod/agents-config.yaml a partir de agents/{id}/config.yaml
 * Uso: node scripts/generate-hf-agents-config.mjs [--out caminho]
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadAllAgentConfigs, modelRef } from './lib/parse-agent-yaml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const defaultOut = resolve(root, 'hf-space', 'friday-prod', 'agents-config.yaml');

const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice(6)
  || (process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null);
const outPath = outArg ? resolve(process.cwd(), outArg) : defaultOut;

const FORGE_ALIAS = {
  orchestrator: 'friday',
  ops: 'byte',
  'vp-pecas': 'pixel',
  macofel: 'lala',
  sophia: 'sophia',
  rebeca: 'rebeca',
  senku: 'senku',
  hefestos: 'hefestos',
  icaro: 'icaro',
  athena: 'athena',
  dedalo: 'dedalo',
};

const HF_TOOLS = {
  orchestrator: [],
  macofel: ['buscar_peca', 'listar_categorias'],
  ops: ['status_github', 'status_deploy'],
  'vp-pecas': ['health_site_vp'],
};

const agents = loadAllAgentConfigs(resolve(root, 'agents'));
if (!agents.length) {
  console.error('Nenhum agents/*/config.yaml encontrado');
  process.exit(1);
}

const doc = {
  _generated: new Date().toISOString(),
  _source: 'agents/*/config.yaml — regen: node scripts/generate-hf-agents-config.mjs',
  defaults: {
    max_tokens: 4096,
    temperature: 0.7,
    provider: 'openrouter',
    env_key: 'OPENROUTER_API_KEY',
  },
};

for (const cfg of agents) {
  const id = cfg.id;
  doc[id] = {
    id,
    name: cfg.name || id,
    forge_alias: FORGE_ALIAS[id] || id,
    role: cfg.role || '',
    description: `${cfg.name || id} — ${cfg.role || 'agente OpenClaw'}`.trim(),
    model: cfg.model || 'google/gemma-4-26b-a4b-it:free',
    model_ref: modelRef(cfg),
    fallbacks: cfg.fallbacks || [],
    skills: cfg.skills || [],
    tools: HF_TOOLS[id] || [],
    hub_tools: [],
  };
}

const yaml = [
  '# Gerado automaticamente — nao editar a mao; use generate-hf-agents-config.mjs',
  `# ${doc._generated}`,
  '',
  'defaults:',
  `  max_tokens: ${doc.defaults.max_tokens}`,
  `  temperature: ${doc.defaults.temperature}`,
  `  provider: ${doc.defaults.provider}`,
  `  env_key: ${doc.defaults.env_key}`,
  '',
];

for (const cfg of agents) {
  const a = doc[cfg.id];
  yaml.push(`${a.id}:`);
  yaml.push(`  id: ${a.id}`);
  yaml.push(`  name: ${JSON.stringify(a.name)}`);
  yaml.push(`  forge_alias: ${a.forge_alias}`);
  yaml.push(`  role: ${JSON.stringify(a.role)}`);
  yaml.push(`  description: ${JSON.stringify(a.description)}`);
  yaml.push(`  model: ${JSON.stringify(a.model)}`);
  yaml.push(`  model_ref: ${JSON.stringify(a.model_ref)}`);
  yaml.push(`  max_tokens: ${doc.defaults.max_tokens}`);
  yaml.push(`  temperature: ${doc.defaults.temperature}`);
  yaml.push('  fallbacks:');
  for (const f of a.fallbacks) yaml.push(`    - ${JSON.stringify(f)}`);
  yaml.push('  skills:');
  for (const s of a.skills) yaml.push(`    - ${JSON.stringify(s)}`);
  yaml.push('  tools:');
  for (const t of a.tools) yaml.push(`    - ${JSON.stringify(t)}`);
  yaml.push('  hub_tools: []');
  yaml.push('');
}

writeFileSync(outPath, yaml.join('\n'), 'utf8');
console.log('[OK] ' + agents.length + ' agentes -> ' + outPath);
