#!/usr/bin/env node
/**
 * Status Macofel — ordem: gateway Vercel → API Macofel → MongoDB (fallback).
 * Saída: JSON uma linha (stdout).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

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

function out(obj, code = 0) {
  console.log(JSON.stringify(obj));
  process.exit(code);
}

async function tryGateway() {
  const base = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
  const token = process.env.OPENCLAW_AUTOMATION_TOKEN;
  if (!base || !token) return null;
  const url = `${base}/openclaw/macofel/status`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, source: 'gateway', error: `${res.status}`, url };
  }
  return { ok: true, source: 'gateway', ...body };
}

async function tryMacofelApi() {
  const base = process.env.MACOFEL_API_BASE?.replace(/\/$/, '');
  const secret = process.env.MACOFEL_CATALOG_SECRET;
  if (!base) return null;
  const url = `${base}/api/admin/catalog/status`;
  const headers = { Accept: 'application/json' };
  if (secret) headers['x-catalog-secret'] = secret;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, source: 'macofel-api', error: `${res.status}`, url };
  }
  return { ok: true, source: 'macofel-api', ...body };
}

function tryMongoScript() {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, ['macofel-count-pending.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.on('close', (code) => {
      try {
        const j = JSON.parse(stdout.trim());
        resolvePromise(
          code === 0 && j.ok
            ? { ...j, source: 'mongodb-script' }
            : { ok: false, source: 'mongodb-script', error: j.error || `exit ${code}` }
        );
      } catch {
        resolvePromise({ ok: false, source: 'mongodb-script', error: 'invalid json' });
      }
    });
  });
}

try {
  const gw = await tryGateway();
  if (gw?.ok) out({ ...gw, at: new Date().toISOString() });

  const api = await tryMacofelApi();
  if (api?.ok) out({ ...api, at: new Date().toISOString() });

  const mongo = await tryMongoScript();
  if (mongo?.ok) out({ ...mongo, at: new Date().toISOString() });

  const errors = [gw, api, mongo].filter(Boolean);
  out(
    {
      ok: false,
      error: 'no macofel status source available',
      tried: ['gateway', 'macofel-api', 'mongodb-script'],
      details: errors,
    },
    1
  );
} catch (e) {
  out({ ok: false, error: String(e.message || e) }, 1);
}
