#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  hfTokenFromEnv,
  hfInferenceModelFromEnv,
  hfModelRef,
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
const hubModel = hfInferenceModelFromEnv();
const openclawRef = hfModelRef(hubModel);
const apiModel = hubModel.startsWith('huggingface/')
  ? hubModel.slice('huggingface/'.length)
  : hubModel;

console.log('=== Teste HF Inference Router ===\n');
console.log('OpenClaw ref:', openclawRef);
console.log('API model:   ', apiModel, '\n');

if (!token) {
  console.log('[FALHA] HF_TOKEN vazio no .env\n');
  process.exit(1);
}
console.log('[OK] HF_TOKEN definido (' + token.length + ' chars)');

const res = await fetch(HF_ROUTER_BASE_URL + '/chat/completions', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: apiModel,
    messages: [{ role: 'user', content: 'Responde apenas: OK em portugues.' }],
    max_tokens: 20,
    stream: false,
  }),
  signal: AbortSignal.timeout(30000),
});

const body = await res.json().catch(() => ({}));

if (res.ok) {
  console.log('[OK] HTTP', res.status);
  console.log('Resposta:', body.choices?.[0]?.message?.content?.trim() || '(vazio)');
  console.log('\nProximo: ec2-sync-env.ps1 + ec2-fix-telegram-models.sh\n');
  process.exit(0);
}

const msg = body.error?.message || JSON.stringify(body).slice(0, 160);
console.log('[FALHA] HTTP', res.status, '-', msg);
process.exit(1);
