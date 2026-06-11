#!/usr/bin/env node
/**
 * Smoke test: gateway Vercel → HF Spaces por perfil.
 * Uso: node scripts/test-hf-spaces-routing.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  for (const rel of ['.env', 'gateway/.env']) {
    const p = resolve(root, rel);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
    }
  }
}
loadEnv();

const GW = (process.env.OPENCLAW_GATEWAY_BASE_URL || 'https://openclaw.lwdigitalforge.com').replace(/\/$/, '');
const token = process.env.OPENCLAW_AUTOMATION_TOKEN?.trim();
const hfToken = process.env.HF_TOKEN?.trim();

if (!token) {
  console.error('OPENCLAW_AUTOMATION_TOKEN em falta no .env');
  process.exit(1);
}

const AGENTS = [
  { id: 'heimdall', profile: 'core', task: 'ping: responde apenas OK-heimdall' },
  { id: 'sophia', profile: 'innovation', task: 'ping: responde apenas OK-sophia' },
  { id: 'macofel', profile: 'macofel', task: 'ping: responde apenas OK-macofel' },
];

async function testHealth(url, label) {
  const res = await fetch(`${url}/health`, {
    headers: hfToken ? { Authorization: `Bearer ${hfToken}` } : {},
  });
  const body = await res.text();
  let json = {};
  try {
    json = JSON.parse(body);
  } catch {
    json = { raw: body.slice(0, 80) };
  }
  const ok = res.ok && (json.ok === true || json.status === 'ok' || json.space_profile);
  console.log(`[${ok ? 'OK' : 'FALHA'}] HF ${label} HTTP ${res.status}`, json.space_profile || json.service || json.raw || '');
  return ok;
}

async function testOrchestrate(agent, task) {
  const res = await fetch(`${GW}/openclaw/orchestrate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ agent, task, async: false }),
  });
  const body = await res.json().catch(() => ({}));
  const ok = res.ok && body.ok !== false;
  const preview = body.mode || body.route?.mode || '?';
  const err = body.error || body.message || body.forwardError;
  console.log(
    `[${ok ? 'OK' : 'FALHA'}] orchestrate ${agent} HTTP ${res.status} mode=${preview}`,
    err ? `err=${String(err).slice(0, 120)}` : '',
  );
  if (body.response) console.log('  response:', String(body.response).slice(0, 120));
  return ok;
}

console.log('Gateway:', GW);
const health = await fetch(`${GW}/api/health`).then((r) => r.json());
console.log('Gateway commit:', health.commit?.slice(0, 7), 'ok:', health.ok);
console.log('');

let passed = 0;
let total = 0;

for (const { id, profile } of AGENTS) {
  const envKey = {
    core: 'HF_OPENCLAW_CORE_URL',
    innovation: 'HF_OPENCLAW_INNOVATION_URL',
    macofel: 'HF_MACOFEL_SPACE_URL',
  }[profile];
  const base = process.env[envKey]?.replace(/\/$/, '');
  if (base) {
    total += 1;
    if (await testHealth(base, profile)) passed += 1;
  }
  total += 1;
  if (await testOrchestrate(id, AGENTS.find((a) => a.id === id).task)) passed += 1;
  console.log('');
}

console.log(`Resultado: ${passed}/${total}`);
process.exit(passed === total ? 0 : 1);
