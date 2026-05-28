#!/usr/bin/env node
/** Testa GET /openclaw/office/status e imprime estados dos agentes. */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const p = resolve(__dirname, '..', '.env');
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

const base = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
const token = process.env.OPENCLAW_AUTOMATION_TOKEN;

if (!base || !token) {
  console.error('Falta OPENCLAW_GATEWAY_BASE_URL ou OPENCLAW_AUTOMATION_TOKEN no .env');
  process.exit(1);
}

const url = `${base}/openclaw/office/status`;
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
const body = await res.json().catch(() => ({}));

console.log(`HTTP ${res.status} · ok=${body.ok} · busy=${body.busy}`);
console.log(`Fontes: macofel=${body.sources?.macofel} github=${body.sources?.github} deploy=${body.sources?.deploy}`);
console.log('');

for (const a of body.agents || []) {
  console.log(`  ${a.name.padEnd(10)} [${a.stateLabel.padEnd(12)}] ${a.detail}`);
}

if (!res.ok) process.exit(1);
