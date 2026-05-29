#!/usr/bin/env node
/**
 * Testa Supabase + opcionalmente GET /openclaw/hub/health no gateway.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(resolve(root, 'gateway', '.env'));
loadEnvFile(resolve(root, '.env'));

const { supabasePing, isHubEnabled } = await import('../gateway/lib/hub-store.mjs');

console.log('=== Hub local (Supabase direto) ===');
console.log('configured:', isHubEnabled());
if (!isHubEnabled()) {
  console.error('[FALHA] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente');
  process.exit(1);
}
try {
  await supabasePing();
  console.log('[OK] Supabase ping');
} catch (e) {
  console.error('[FALHA] Supabase:', e.message);
  process.exit(1);
}

const base = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
const token = process.env.OPENCLAW_AUTOMATION_TOKEN;
if (!base || !token) {
  console.log('\n=== Gateway remoto ===');
  console.log('[SKIP] OPENCLAW_GATEWAY_BASE_URL ou TOKEN ausente no .env');
  process.exit(0);
}

console.log('\n=== Gateway remoto ===');
const url = `${base}/openclaw/hub/health`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json().catch(() => ({}));
console.log('GET', url);
console.log('HTTP', res.status, JSON.stringify(body, null, 2));
process.exit(res.ok && body.ok ? 0 : 1);
