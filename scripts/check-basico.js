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
async function fetchJsonWithTimeout(url, init = {}, timeoutMs = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  } finally {
    clearTimeout(t);
  }
}
console.log('=== FASE 1: Jarvis / Gateway ===\n');
step('OPENCLAW_GATEWAY_BASE_URL', Boolean(base));
step('OPENCLAW_AUTOMATION_TOKEN', Boolean(token));
if (!base) {
  console.log('\nPare: preencha .env');
  process.exitCode = 1;
} else {
try {
  const { res, body } = await fetchJsonWithTimeout(`${base}/api/health`, {}, 15000);
  step('GET /api/health', res.ok && body.ok, 'HTTP ' + res.status);
} catch (e) { step('GET /api/health', false, String(e.message)); }
}
if (!token) {
  console.log('\nToken em falta.');
  process.exitCode = 1;
}
const auth = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
try {
  if (base && token) {
    const { res, body } = await fetchJsonWithTimeout(`${base}/jarvis`, { headers: auth }, 15000);
    step('GET /jarvis', res.ok && body.agent === 'jarvis', 'HTTP ' + res.status);
  }
} catch (e) { step('GET /jarvis', false, String(e.message)); }
try {
  if (base && token) {
    const { res, body } = await fetchJsonWithTimeout(
      `${base}/jarvis`,
      {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'ajuda' }),
      },
      20000
    );
    step('POST /jarvis', res.ok && body.ok && body.reply, 'HTTP ' + res.status);
    if (body.reply) console.log('\n  Jarvis: ' + body.reply + '\n');
  }
} catch (e) { step('POST /jarvis', false, String(e.message)); }
const n = steps.filter(s => !s.ok).length;
console.log(n ? `\n${n} falha(s).` : '\nBasico OK. Telegram = fase 2.\n');
process.exitCode = process.exitCode || (n ? 1 : 0);