/**
 * Pergunta ao Jarvis no gateway Vercel.
 * Uso: node jarvis-ask.mjs "status macofel"
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

const message = process.argv.slice(2).join(' ') || 'ajuda';
const base = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
const token = process.env.OPENCLAW_AUTOMATION_TOKEN;

if (!base || !token) {
  console.log(
    JSON.stringify({
      ok: false,
      error: 'OPENCLAW_GATEWAY_BASE_URL and OPENCLAW_AUTOMATION_TOKEN required',
    })
  );
  process.exit(1);
}

const url = `${base}/jarvis`;
const ac = new AbortController();
const t = setTimeout(() => ac.abort(new Error('timeout')), 30000);
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};
const bypass = process.env.VERCEL_PROTECTION_BYPASS?.trim();
if (bypass) headers['x-vercel-protection-bypass'] = bypass;
const res = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify({ message }),
  signal: ac.signal,
});
clearTimeout(t);

const body = await res.json().catch(() => ({}));
console.log(JSON.stringify({ http: res.status, ...body }, null, 2));
process.exit(res.ok && body.ok ? 0 : 1);

