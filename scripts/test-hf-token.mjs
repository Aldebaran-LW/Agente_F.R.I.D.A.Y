import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  hfTokenFromEnv,
  hfInferenceModelFromEnv,
  HF_ROUTER_BASE_URL,
} from './lib/hf-inference-config.mjs';

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
const token = hfTokenFromEnv();
const inferModel = hfInferenceModelFromEnv().replace(/^huggingface\//, '');
const steps = [];
function step(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  console.log('  [' + (ok ? 'OK' : 'FALHA') + '] ' + name + (detail ? ' — ' + detail : ''));
}

async function hf(path, init = {}) {
  const res = await fetch('https://huggingface.co/api' + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { res, body };
}

console.log('=== Teste HF_TOKEN (Hugging Face Hub) ===\n');
step('HF_TOKEN definido', Boolean(token));
if (!token) { console.log('\nPare: preencha HF_TOKEN no .env\n'); process.exit(1); }

let user = null;
try {
  const { res, body } = await hf('/whoami-v2');
  user = body?.name || null;
  const role = body?.auth?.accessToken?.role || body?.type || '?';
  const orgs = (body?.orgs || []).map((o) => o.name).join(', ') || '—';
  step('whoami-v2', res.ok, 'user=' + (user || '?') + ' role=' + role + ' orgs=' + orgs);
} catch (e) { step('whoami-v2', false, e.message); }

if (user) {
  for (const item of [
    ['spaces', '/spaces?author=' + encodeURIComponent(user) + '&limit=20'],
    ['models', '/models?author=' + encodeURIComponent(user) + '&limit=20'],
    ['datasets', '/datasets?author=' + encodeURIComponent(user) + '&limit=20'],
  ]) {
    try {
      const { res, body } = await hf(item[1]);
      const count = Array.isArray(body) ? body.length : 0;
      step('list ' + item[0], res.ok, 'count=' + count);
    } catch (e) { step('list ' + item[0], false, e.message); }
  }
}

try {
  const { res } = await hf('/settings/webhooks');
  step('webhooks API', res.ok);
} catch (e) { step('webhooks API', false, e.message); }

try {
  const res = await fetch(HF_ROUTER_BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: inferModel, messages: [{ role: 'user', content: 'ok' }], max_tokens: 3 }),
    signal: AbortSignal.timeout(25000),
  });
  const body = await res.json().catch(() => ({}));
  const noProvider = body?.error?.message?.includes('not supported by any provider');
  step('inference router', res.ok, res.ok ? ('model=' + inferModel) : noProvider ? 'sem provider activo na conta HF' : 'HTTP ' + res.status);
} catch (e) { step('inference router', false, e.message); }

const fails = steps.filter((s) => !s.ok).length;
console.log(fails ? '\n' + fails + ' falha(s).\n' : '\nHF_TOKEN OK. Proximo: Space privado openclaw-demo\n');
process.exitCode = fails ? 1 : 0;