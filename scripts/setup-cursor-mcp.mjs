#!/usr/bin/env node
/**
 * Gera .cursor/mcp.json a partir do .env (não commitar — ver .gitignore).
 * Uso: node scripts/setup-cursor-mcp.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');
const outPath = resolve(root, '.cursor', 'mcp.json');

function loadEnv() {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [k, ...rest] = t.split('=');
    out[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv();
const baseUrl =
  env.OPENCLAW_GATEWAY_BASE_URL?.trim() || 'https://openclaw.lwdigitalforge.com';
const token = env.OPENCLAW_AUTOMATION_TOKEN?.trim();

if (!token) {
  console.error('OPENCLAW_AUTOMATION_TOKEN ausente no .env');
  process.exit(1);
}

const config = {
  mcpServers: {
    openclaw: {
      command: 'node',
      args: ['scripts/openclaw-mcp-server.mjs'],
      env: {
        OPENCLAW_GATEWAY_BASE_URL: baseUrl,
        OPENCLAW_AUTOMATION_TOKEN: token,
      },
    },
  },
};

mkdirSync(resolve(root, '.cursor'), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`OK: ${outPath}`);
console.log(`Gateway: ${baseUrl}`);
console.log('Reinicia o Cursor para carregar o MCP openclaw.');
