#!/usr/bin/env node
/**
 * Gera hf-space/friday-prod/agents-config.yaml a partir de agents/{id}/config.yaml
 * Uso: node scripts/generate-hf-agents-config.mjs [--out caminho]
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadAllAgentConfigs, modelRef } from './lib/parse-agent-yaml.mjs';
import { profileAgentSet } from './lib/hf-space-profiles.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const profileId = process.argv.find((a) => a.startsWith('--profile='))?.slice(10)
  || (process.argv.includes('--profile') ? process.argv[process.argv.indexOf('--profile') + 1] : 'unified');

const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice(6)
  || (process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null);
const defaultOut = resolve(root, 'hf-space', profileId === 'unified' ? 'friday-prod' : profileId, 'agents-config.yaml');
const outPath = outArg ? resolve(process.cwd(), outArg) : defaultOut;

const profileFilter = profileAgentSet(profileId);

const FORGE_ALIAS = {
  orchestrator: 'friday',
  heimdall: 'heimdall',
  veldora: 'veldora',
  odin: 'veldora',
  rimuru: 'rimuru',
  athena: 'rimuru',
  gideon: 'gideon',
  senku: 'senku',
  yato: 'yato',
  sophia: 'sophia',
  'vp-pecas': 'vp-pecas',
  macofel: 'macofel',
  ops: 'heimdall',
  byte: 'heimdall',
  pixel: 'vp-pecas',
  lala: 'macofel',
  rebeca: 'rebeca',
  hefestos: 'hefestos',
  icaro: 'icaro',
  dedalo: 'dedalo',
};

/** Agentes inovação: rotas /run/* usam tools HTTP — não OpenRouter no Space. */
const INNOVATION_SKIP_OPENROUTER = new Set(['sophia', 'yato', 'senku', 'gideon']);

const HF_TOOLS = {
  orchestrator: [],
  macofel: ['buscar_peca', 'listar_categorias'],
  heimdall: ['status_github', 'status_deploy'],
  'vp-pecas': ['health_site_vp'],
  sophia: [],
  yato: [],
  senku: [],
  gideon: [],
};

let agents = loadAllAgentConfigs(resolve(root, 'agents'));
if (profileFilter) {
  agents = agents.filter((cfg) => profileFilter.has(cfg.id));
}
if (!agents.length) {
  console.error('Nenhum agents/*/config.yaml para profile', profileId);
  process.exit(1);
}

const doc = {
  _generated: new Date().toISOString(),
  _profile: profileId,
  _source: 'agents/*/config.yaml — regen: node scripts/generate-hf-agents-config.mjs --profile ' + profileId,
  defaults: {
    max_tokens: 4096,
    temperature: 0.7,
    provider: 'huggingface',
    env_key: 'HF_TOKEN',
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
  if (cfg.provider === 'huggingface') {
    doc[id].provider = 'huggingface';
    doc[id].env_key = 'HF_TOKEN';
    doc[id].llm_skip_openrouter = true;
    const mid = String(cfg.model || 'Qwen/Qwen2.5-7B-Instruct:fastest').replace(/^huggingface\//, '');
    doc[id].hf_inference_model = mid;
  }
  if (cfg.provider === 'kilo') {
    doc[id].provider = 'kilo';
    doc[id].env_key = 'KILO_API_KEY';
    doc[id].kilo_model = cfg.model || 'kilo-auto/free';
    doc[id].kilo_fallbacks = cfg.fallbacks?.length ? cfg.fallbacks : ['kilo-auto/free'];
  }
  if (cfg.provider === 'mistral') {
    doc[id].provider = 'mistral';
    doc[id].env_key = 'MISTRAL_API_KEY';
    doc[id].llm_skip_openrouter = true;
  }
  if (INNOVATION_SKIP_OPENROUTER.has(id) && cfg.provider !== 'mistral' && cfg.provider !== 'huggingface') {
    doc[id].llm_skip_openrouter = true;
    doc[id].hf_inference_model = 'HuggingFaceH4/zephyr-7b-beta';
  }
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
  if (a.provider) yaml.push(`  provider: ${JSON.stringify(a.provider)}`);
  if (a.env_key) yaml.push(`  env_key: ${JSON.stringify(a.env_key)}`);
  if (a.kilo_model) yaml.push(`  kilo_model: ${JSON.stringify(a.kilo_model)}`);
  if (a.kilo_fallbacks?.length) {
    yaml.push('  kilo_fallbacks:');
    for (const f of a.kilo_fallbacks) yaml.push(`    - ${JSON.stringify(f)}`);
  }
  if (a.llm_skip_openrouter) yaml.push('  llm_skip_openrouter: true');
  if (a.hf_inference_model) yaml.push(`  hf_inference_model: ${JSON.stringify(a.hf_inference_model)}`);
  yaml.push('  fallbacks:');
  const fb = Array.isArray(a.fallbacks) ? a.fallbacks : [];
  if (!fb.length) yaml.push('    []');
  else for (const f of fb) yaml.push(`    - ${JSON.stringify(f)}`);
  yaml.push('  skills:');
  for (const s of a.skills) yaml.push(`    - ${JSON.stringify(s)}`);
  yaml.push('  tools:');
  const toolList = [...new Set([...(a.tools || []), 'search_openclaw_docs'])];
  for (const t of toolList) yaml.push(`    - ${JSON.stringify(t)}`);
  yaml.push('  hub_tools: []');
  yaml.push('');
}

writeFileSync(outPath, yaml.join('\n'), 'utf8');
console.log('[OK] profile=' + profileId + ' | ' + agents.length + ' agentes -> ' + outPath);
