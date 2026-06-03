#!/usr/bin/env node
/**
 * Copia scripts/lib e assets mínimos para dentro de gateway/ (Root Directory Vercel).
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gatewayDir = resolve(__dirname, '..');
const repoRoot = resolve(gatewayDir, '..');
const srcLib = resolve(repoRoot, 'scripts', 'lib');
const dest = resolve(gatewayDir, 'lib', 'repo-scripts');

const FILES = [
  'innovation-status-core.mjs',
  'rimuru-token-core.mjs',
  'rimuru-providers.mjs',
  'heimdall-flow-core.mjs',
  'rebeca-design-core.mjs',
  'veldora-audit-core.mjs',
  'scheduled-whatsapp-core.mjs',
  'whatsapp-contacts.mjs',
  'preferences-memory.mjs',
];

mkdirSync(dest, { recursive: true });
const veldoraDest = resolve(gatewayDir, 'lib', 'veldora');
mkdirSync(veldoraDest, { recursive: true });

cpSync(resolve(repoRoot, 'agents', 'veldora', 'validate-sources.mjs'), resolve(veldoraDest, 'validate-sources.mjs'));
for (const txt of ['sources-allowlist.txt', 'sources-blocklist.txt']) {
  cpSync(resolve(repoRoot, 'agents', 'veldora', txt), resolve(veldoraDest, txt));
}

for (const agent of ['heimdall', 'rimuru']) {
  mkdirSync(resolve(gatewayDir, 'agents', agent), { recursive: true });
  const src = resolve(repoRoot, 'agents', agent);
  if (agent === 'heimdall') {
    cpSync(resolve(src, 'watch-agents.json'), resolve(gatewayDir, 'agents', agent, 'watch-agents.json'));
  }
  if (agent === 'rimuru') {
    cpSync(resolve(src, 'token-policy.json'), resolve(gatewayDir, 'agents', agent, 'token-policy.json'));
  }
}

const ROOT_PATCH =
  "const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');";
const DATA_ROOT_FN = `
function openclawDataRoot() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) return '/tmp/openclaw';
  return resolve(root, 'data');
}`;
// Só paths de escrita/leitura em data/* — não substituir dentro de openclawDataRoot()
const DATA_PATH_RE = /resolve\(root, 'data',/g;
const DATA_PATH_TO = "resolve(openclawDataRoot(),";

for (const name of FILES) {
  let text = readFileSync(resolve(srcLib, name), 'utf8');
  text = text.replace(
    '../../agents/veldora/validate-sources.mjs',
    '../veldora/validate-sources.mjs',
  );
  text = text.replace(
    /const root = resolve\(__dirname, '\.\.', '\.\.'\);/g,
    ROOT_PATCH,
  );
  text = text.replace(
    /const root = resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\), '\.\.', '\.\.'\);/g,
    ROOT_PATCH,
  );
  text = text.replaceAll('../../gateway/lib/', '../');
  if (name === 'rimuru-token-core.mjs' || name === 'heimdall-flow-core.mjs') {
    if (!text.includes('function openclawDataRoot')) {
      text = text.replace(ROOT_PATCH, ROOT_PATCH + DATA_ROOT_FN);
    }
    text = text.replace(DATA_PATH_RE, DATA_PATH_TO);
  }
  writeFileSync(resolve(dest, name), text, 'utf8');
}

const HF_BUNDLE = [
  ['scripts/hf/proposal-generator.mjs', 'proposal-generator.mjs'],
  ['scripts/hf/proposal-approval.mjs', 'proposal-approval.mjs'],
  ['scripts/github/executor.mjs', 'github-executor.mjs'],
];

for (const [rel, destName] of HF_BUNDLE) {
  let text = readFileSync(resolve(repoRoot, rel), 'utf8');
  text = text.replaceAll('../github/executor.mjs', './github-executor.mjs');
  text = text.replaceAll('../lib/preferences-memory.mjs', './preferences-memory.mjs');
  text = text.replace(
    /import \{ dirname, join \} from 'node:path';/,
    "import { dirname, join, resolve } from 'node:path';",
  );
  text = text.replace(
    /const __dirname = dirname\(fileURLToPath\(import\.meta\.url\)\);\r?\nconst WORKSPACE_ROOT = join\(__dirname, '\.\.', '\.\.'\);/,
    ROOT_PATCH,
  );
  text = text.replace(
    /function openclawDataRoot\(\) \{[^}]+\}/s,
    DATA_ROOT_FN.trim(),
  );
  text = text.replace(
    /function proposalsDataRoot\(\) \{\s*return openclawDataRoot\(\);\s*\}/,
    'function proposalsDataRoot() { return openclawDataRoot(); }',
  );
  if (!text.includes('function openclawDataRoot')) {
    text = text.replace(ROOT_PATCH, ROOT_PATCH + DATA_ROOT_FN);
  }
  writeFileSync(resolve(dest, destName), text, 'utf8');
}

console.log('[prepare-vercel] lib/repo-scripts + agents/heimdall/watch-agents.json');
