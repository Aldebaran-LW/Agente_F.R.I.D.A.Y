#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const p = resolve(root, '.env');
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

function argValue(flag) {
  const eq = process.argv.find((a) => a.startsWith(flag + '='));
  if (eq) return eq.slice(flag.length + 1);
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  return null;
}

loadEnv();
const ean = argValue('--ean');
const urlsRaw = argValue('--urls') || '';
const imageUrls = urlsRaw.split(',').map((u) => u.trim()).filter(Boolean);
const approved = process.argv.includes('--approved');

if (!approved) {
  console.log(JSON.stringify({ ok: false, error: 'approval_required', message: 'Use --approved apos sim/confirmar/ok' }));
  process.exit(1);
}

function catalogUrl(path) {
  const base = process.env.MACOFEL_API_BASE?.replace(/\/$/, '') || '';
  if (!base) return null;
  if (base.includes('/api/import')) return `${base.replace(/\/api\/import\/?$/, '')}${path}`;
  return `${base}${path}`;
}

async function main() {
  if (!ean || !imageUrls.length) {
    console.log(JSON.stringify({ ok: false, error: 'ean e --urls obrigatorios' }));
    process.exit(1);
  }
  const url = catalogUrl('/api/admin/catalog/images/sync');
  if (!url) {
    console.log(JSON.stringify({ ok: false, error: 'MACOFEL_API_BASE missing' }));
    process.exit(1);
  }
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const secret = process.env.MACOFEL_CATALOG_SECRET?.trim();
  const bearer = process.env.MACOFEL_CRON_BEARER?.trim();
  if (secret) headers['x-catalog-secret'] = secret;
  else if (bearer) headers.Authorization = `Bearer ${bearer}`;
  else {
    console.log(JSON.stringify({ ok: false, error: 'MACOFEL_CATALOG_SECRET ou MACOFEL_CRON_BEARER missing' }));
    process.exit(1);
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ean, imageUrls }) });
  const body = await res.json().catch(() => ({}));
  const out = { ok: res.ok, source: 'macofel-api-ec2-script', ean, urlCount: imageUrls.length, status: res.status, ...body, at: new Date().toISOString() };
  console.log(JSON.stringify(out, null, 2));
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => { console.log(JSON.stringify({ ok: false, error: String(e.message || e) })); process.exit(1); });