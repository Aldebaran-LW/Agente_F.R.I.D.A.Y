#!/usr/bin/env node
/**
 * Suite integrada: gateway, rotas openclaw, Jarvis POST, HF, validacao.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Rotas GET testáveis — espelha OPENCLAW_ROUTES sem importar gateway (evita mongodb local). */
const OPENCLAW_GET_ROUTES = [
  'deploy/health',
  'github/status',
  'hub/health',
  'hub/recent',
  'macofel/status',
  'office/status',
  'rimuru/status',
  'heimdall/flow',
  'innovation/status',
  'vercel/status',
  'vp-pecas/health',
  'mcp/tools',
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const p of [resolve(root, '.env'), resolve(root, 'gateway', '.env')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();

const base = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
const token = process.env.OPENCLAW_AUTOMATION_TOKEN;
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? 'OK' : 'FALHA'}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function gw(path, init = {}, timeoutMs = 20000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
  try {
    const headers = { Accept: 'application/json', ...(init.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const bypass = process.env.VERCEL_PROTECTION_BYPASS?.trim();
    if (bypass) headers['x-vercel-protection-bypass'] = bypass;
    const res = await fetch(`${base}${path}`, { ...init, headers, signal: ac.signal });
    const text = await res.text();
    let body = {};
    try {
      body = JSON.parse(text);
    } catch {
      body = { _raw: text.slice(0, 120) };
    }
    return { res, body };
  } finally {
    clearTimeout(t);
  }
}

console.log('=== TEST ALL LOGIC ===\n');

// --- Config ---
record('OPENCLAW_GATEWAY_BASE_URL', Boolean(base));
record('OPENCLAW_AUTOMATION_TOKEN', Boolean(token));
if (!base || !token) {
  console.log('\nAbort: .env incompleto');
  process.exit(1);
}

// --- Core ---
try {
  const { res, body } = await gw('/api/health');
  record('GET /api/health', res.ok && body.ok, `HTTP ${res.status}`);
} catch (e) {
  record('GET /api/health', false, e.message);
}

try {
  const { res, body } = await gw('/jarvis');
  record('GET /jarvis', res.ok && body.agent === 'jarvis', `HTTP ${res.status}`);
} catch (e) {
  record('GET /jarvis', false, e.message);
}

const jarvisMessages = [
  ['ajuda', (b) => b.ok && b.reply],
  ['status macofel', (b) => b.ok && (b.reply || b.workflow)],
  ['repos github', (b) => b.ok && (b.reply || b.workflow)],
  ['sites no ar', (b) => b.ok && (b.reply || b.workflow)],
  ['resumo portfolio', (b) => b.ok && (b.reply || b.workflow)],
];

for (const [msg, pred] of jarvisMessages) {
  try {
    const { res, body } = await gw('/jarvis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    }, 30000);
    record(`POST /jarvis "${msg}"`, res.ok && pred(body), `HTTP ${res.status}`);
  } catch (e) {
    record(`POST /jarvis "${msg}"`, false, e.message);
  }
}

// --- Rotas openclaw (router unificado) ---
const getRoutes = OPENCLAW_GET_ROUTES;
for (const route of getRoutes) {
  try {
    const { res, body } = await gw(`/openclaw/${route}`, {}, route === 'office/status' ? 30000 : 20000);
    const ok = res.ok && body.ok !== false;
    record(`GET /openclaw/${route}`, ok, `HTTP ${res.status}`);
  } catch (e) {
    record(`GET /openclaw/${route}`, false, e.message);
  }
}

// orchestrate POST
try {
  const { res, body } = await gw('/openclaw/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent: 'yato', task: 'ping teste suite' }),
  }, 15000);
  record('POST /openclaw/orchestrate yato', res.status < 500, `HTTP ${res.status} ok=${body.ok}`);
} catch (e) {
  record('POST /openclaw/orchestrate yato', false, e.message);
}

// macofel sync sem approved -> 403 esperado
try {
  const { res, body } = await gw('/openclaw/macofel/images/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ean: '0000000000000', imageUrls: ['https://example.com/x.jpg'] }),
  });
  record('POST macofel/sync sem approved → 403', res.status === 403 && body.error === 'aprovacao_requerida', `HTTP ${res.status}`);
} catch (e) {
  record('POST macofel/sync sem approved', false, e.message);
}

// --- HF Spaces ---
const hfUrls = [
  ['friday-prod /', process.env.HF_FRIDAY_PROD_URL?.replace(/\/$/, '') || 'https://aldebaran-lw-friday-prod.hf.space'],
  ['openclaw-demo /health', process.env.HF_DEMO_URL?.replace(/\/$/, '') || 'https://aldebaran-lw-openclaw-demo.hf.space'],
].filter(([, u]) => u);

for (const [label, url] of hfUrls) {
  try {
    const path = label.includes('health') ? '/health' : '/';
    const res = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(25000) });
    const body = await res.json().catch(() => ({}));
    record(`HF ${label}`, res.ok && body.ok !== false, `HTTP ${res.status}`);
  } catch (e) {
    record(`HF ${label}`, false, e.message);
  }
}

// --- Resumo ---
const failed = results.filter((r) => !r.ok);
console.log(`\n=== RESUMO: ${results.length - failed.length}/${results.length} OK ===`);
if (failed.length) {
  console.log('\nFalhas:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? ': ' + f.detail : ''}`);
  process.exit(1);
}
console.log('\nSuite completa OK.\n');
