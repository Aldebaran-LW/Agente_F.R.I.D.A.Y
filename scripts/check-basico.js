#!/usr/bin/env node
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
const steps = [];
function step(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  console.log(`  [${ok ? 'OK' : 'FALHA'}] ${name}${detail ? ' - ' + detail : ''}`);
}
console.log('=== FASE 1: Jarvis / Gateway ===\n');
step('OPENCLAW_GATEWAY_BASE_URL', Boolean(base));
step('OPENCLAW_AUTOMATION_TOKEN', Boolean(token));
if (!base) { console.log('\nPare: preencha .env'); process.exit(1); }
try {
  const h = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) });
  const hb = await h.json().catch(() => ({}));
  step('GET /api/health', h.ok && hb.ok, 'HTTP ' + h.status);
} catch (e) { step('GET /api/health', false, String(e.message)); }
if (!token) { console.log('\nToken em falta.'); process.exit(1); }
const auth = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
try {
  const r = await fetch(`${base}/jarvis`, { headers: auth, signal: AbortSignal.timeout(15000) });
  const b = await r.json().catch(() => ({}));
  step('GET /jarvis', r.ok && b.agent === 'jarvis', 'HTTP ' + r.status);
} catch (e) { step('GET /jarvis', false, String(e.message)); }
try {
  const r = await fetch(`${base}/jarvis`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'ajuda' }), signal: AbortSignal.timeout(20000),
  });
  const b = await r.json().catch(() => ({}));
  step('POST /jarvis', r.ok && b.ok && b.reply, 'HTTP ' + r.status);
  if (b.reply) console.log('\n  Jarvis: ' + b.reply + '\n');
} catch (e) { step('POST /jarvis', false, String(e.message)); }
const n = steps.filter(s => !s.ok).length;
console.log(n ? `\n${n} falha(s).` : '\nBasico OK. Telegram = fase 2.\n');
process.exit(n ? 1 : 0);