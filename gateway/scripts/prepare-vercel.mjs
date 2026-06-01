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
  "const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');";

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
  writeFileSync(resolve(dest, name), text, 'utf8');
}

console.log('[prepare-vercel] lib/repo-scripts + agents/heimdall/watch-agents.json');
