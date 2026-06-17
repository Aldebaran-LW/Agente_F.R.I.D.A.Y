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
function extraHeaders() {
  const h = {};
  const bypass = process.env.VERCEL_PROTECTION_BYPASS?.trim();
  if (bypass) h['x-vercel-protection-bypass'] = bypass;
  return h;
}

async function fetchJsonWithTimeout(url, init = {}, timeoutMs = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...extraHeaders(), ...(init.headers || {}) },
      signal: ac.signal,
    });
    const text = await res.text();
    let body = {};
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
    const vercelAuth = res.status === 401 && text.includes('Authentication Required');
    return { res, body, vercelAuth };
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
  const { res, body, vercelAuth } = await fetchJsonWithTimeout(`${base}/api/health`, {}, 15000);
  const detail =
    'HTTP ' +
    res.status +
    (vercelAuth ? ' · desliga Vercel Authentication no projeto' : '');
  step('GET /api/health', res.ok && body.ok, detail);
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
    const jarvisDetail =
      'HTTP ' +
      res.status +
      (body.automation_token_configured === false
        ? ' · OPENCLAW_AUTOMATION_TOKEN ausente na Vercel (nao e VERCEL_API_TOKEN)'
        : body.automation_token_configured === true
          ? ' · token configurado no servidor'
          : '');
    step('GET /jarvis', res.ok && body.agent === 'jarvis', jarvisDetail);
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
    const postDetail =
      'HTTP ' +
      res.status +
      (body.error === 'OPENCLAW_AUTOMATION_TOKEN not configured'
        ? ' · define OPENCLAW_AUTOMATION_TOKEN na Vercel (Environment Variables) e redeploy'
        : res.status === 401
          ? ' · token diferente entre Vercel e .env local'
          : '');
    step('POST /jarvis', res.ok && body.ok && body.reply, postDetail);
    if (body.reply) console.log('\n  Jarvis: ' + body.reply + '\n');
  }
} catch (e) { step('POST /jarvis', false, String(e.message)); }
try {
  if (base && token) {
    const { res, body } = await fetchJsonWithTimeout(
      `${base}/openclaw/office/status`,
      { headers: auth },
      25000
    );
    const agents = body.agents?.length ?? 0;
    const officeReachable = agents >= 4 && Array.isArray(body.agents);
    const portfolioIncident = officeReachable && !body.ok;
    step(
      'GET /openclaw/office/status',
      officeReachable,
      `HTTP ${res.status} · ${agents} agentes` +
        (portfolioIncident ? ' · incidente no portfólio (endpoint OK)' : '')
    );
    if (body.agents?.length) {
      for (const a of body.agents) {
        console.log(`       ${a.name}: ${a.stateLabel} — ${a.detail}`);
      }
    }
  }
} catch (e) {
  step('GET /openclaw/office/status', false, String(e.message));
}
const n = steps.filter(s => !s.ok).length;
console.log(n ? `\n${n} falha(s).` : '\nBasico OK. Painel: /office · Telegram = fase 2.\n');
process.exitCode = process.exitCode || (n ? 1 : 0);