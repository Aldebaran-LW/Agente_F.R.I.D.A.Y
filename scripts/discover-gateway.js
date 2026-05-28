#!/usr/bin/env node
/**
 * Descobre qual URL do gateway responde GET /api/health com 200.
 * Uso: node discover-gateway.js
 */
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

const candidates = [
  process.env.OPENCLAW_GATEWAY_BASE_URL,
  'https://agente-openclaw.vercel.app',
  'https://openclaw.lwdigitalforge.com',
  'https://openclaw.vercel.app',
].filter(Boolean);

const unique = [...new Set(candidates.map((u) => u.replace(/\/$/, '')))];

console.log('=== Descobrir gateway (GET /api/health) ===\n');

let winner = null;

for (const base of unique) {
  const url = `${base}/api/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const body = await res.json().catch(() => ({}));
    const authPage = (await fetch(base).then((r) => r.text()).catch(() => '')).includes(
      'Authentication Required'
    );
    const ok = res.ok && body.ok;
    console.log(`${ok ? '[OK]' : '[--]'} ${base} -> HTTP ${res.status}${authPage ? ' (Vercel Auth no site)' : ''}`);
    if (ok && !winner) winner = base;
  } catch (e) {
    console.log(`[ERR] ${base} -> ${e.message}`);
  }
}

console.log('');
if (winner) {
  console.log('Use no .env:');
  console.log(`OPENCLAW_GATEWAY_BASE_URL=${winner}`);
} else {
  console.log('Nenhum host com /api/health 200.');
  console.log('Vercel: Root Directory=gateway, Authentication OFF, redeploy.');
}

process.exit(winner ? 0 : 1);
