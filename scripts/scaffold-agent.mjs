#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const id = process.argv.find((a) => a.startsWith('--id='))?.slice(5)
  || process.argv[process.argv.indexOf('--id') + 1];
const name = process.argv.find((a) => a.startsWith('--name='))?.slice(7)
  || process.argv[process.argv.indexOf('--name') + 1] || id;
const model = process.argv.find((a) => a.startsWith('--model='))?.slice(8)
  || 'google/gemma-4-26b-a4b-it:free';

if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Uso: node scripts/scaffold-agent.mjs --id meu-agente --name "Meu Agente" [--model openrouter/id:free]');
  process.exit(1);
}

const dir = resolve(root, 'agents', id);
if (existsSync(dir)) {
  console.error('Ja existe: ' + dir);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const cfg = `# ${name}
id: ${id}
name: ${name}
role: Agente custom Aldebaran-LW

llm:
  provider: openrouter
  env_key: OPENROUTER_API_KEY
  model: ${model}
  fallbacks:
    - deepseek/deepseek-v4-flash:free

skills:
  - politica-seguranca

secrets:
  gateway: [OPENCLAW_GATEWAY_BASE_URL, OPENCLAW_AUTOMATION_TOKEN]
`;

const agentsMd = `# Cerebro: ${name}

Obedecer POLITICA-SEGURANCA.md.

Config: config.yaml · Arquitetura: docs/ARQUITETURA-AGENTES.md

## Escopo

- (descrever tarefas)

## Aprovacao

Escrita em producao so com sim/confirmar do Lucas.
`;

writeFileSync(resolve(dir, 'config.yaml'), cfg, 'utf8');
writeFileSync(resolve(dir, 'AGENTS.md'), agentsMd, 'utf8');

const examplePath = resolve(root, 'openclaw.json.example');
if (existsSync(examplePath)) {
  const doc = JSON.parse(readFileSync(examplePath, 'utf8'));
  doc.agents.list.push({
    id,
    name,
    workspace: `agents/${id}`,
    skills: ['politica-seguranca'],
    model: { primary: `openrouter/${model}`, fallbacks: ['openrouter/deepseek/deepseek-v4-flash:free'] },
  });
  writeFileSync(examplePath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
}

console.log('[OK] Criado agents/' + id + '/');
console.log('  node scripts/validate-agent-config.mjs');
console.log('  node scripts/sync-agent-config-to-openclaw.mjs --emit-sh');