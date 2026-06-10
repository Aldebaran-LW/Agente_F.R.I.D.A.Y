#!/usr/bin/env node
/**
 * Sincroniza variaveis HF/OpenClaw para o projeto Vercel gateway.
 * Uso: node scripts/vercel-sync-hf-env.mjs
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

const token = process.env.VERCEL_API_TOKEN?.trim() || process.env.VERCEL_TOKEN?.trim();
const teamId = process.env.VERCEL_TEAM_ID?.trim();
const projectId = process.env.VERCEL_PROJECT_ID?.trim() || 'prj_m66Z8wWFqgUQBqfejjcRA1nhqkXP';

if (!token) {
  console.error('VERCEL_API_TOKEN em falta no .env');
  process.exit(1);
}

const SYNC_KEYS = [
  ['HF_OPENCLAW_CORE_URL', 'plain'],
  ['HF_OPENCLAW_INNOVATION_URL', 'plain'],
  ['HF_MACOFEL_SPACE_URL', 'plain'],
  ['HF_CORPUS_DATASET', 'plain'],
  ['HF_BACKUP_DATASET', 'plain'],
  ['HF_FRIDAY_PROD_URL', 'plain'],
  ['HF_TOKEN', 'secret'],
  ['OPENCLAW_AUTOMATION_TOKEN', 'secret'],
  ['OPENCLAW_INTERNAL_TOKEN', 'secret'],
  ['ORCHESTRATE_INNOVATION_TIMEOUT_MS', 'plain'],
];

const apiBase = 'https://api.vercel.com';
const teamQ = teamId ? `?teamId=${teamId}` : '';

async function api(path, opts = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const list = await api(`/v9/projects/${projectId}/env${teamQ}`);
if (!list.ok) {
  console.error('Falha listar env:', list.status, list.data);
  process.exit(1);
}

const existing = new Map((list.data.envs || []).map((e) => [e.key, e]));

for (const [key, kind] of SYNC_KEYS) {
  const value = process.env[key]?.trim();
  if (!value) {
    console.log('[SKIP]', key);
    continue;
  }

  const prev = existing.get(key);
  if (prev) {
    const del = await api(`/v9/projects/${projectId}/env/${prev.id}${teamQ}`, { method: 'DELETE' });
    if (!del.ok) {
      console.log('[WARN] delete', key, del.status);
    }
  }

  const body = {
    key,
    value,
    type: kind === 'secret' ? 'encrypted' : 'plain',
    target: ['production', 'preview', 'development'],
  };
  const create = await api(`/v10/projects/${projectId}/env${teamQ}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  console.log(`[${create.ok ? 'OK' : 'FALHA'}] ${key} HTTP ${create.status}`);
}

console.log('\nProjeto:', projectId, teamId || '(personal)');
