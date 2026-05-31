#!/usr/bin/env node
/** Simula GET /openclaw/hub/health com gateway/.env */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, 'gateway', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const { dispatchOpenclaw } = await import('../gateway/lib/openclaw-handlers.mjs');
const token = process.env.OPENCLAW_AUTOMATION_TOKEN || 'test-token';
process.env.OPENCLAW_AUTOMATION_TOKEN = token;

let status = 0;
let body = '';
const res = {
  statusCode: 200,
  status(c) { status = c; return this; },
  json(o) { body = JSON.stringify(o); console.log('HTTP', status, body); return this; },
  setHeader() { return this; },
  end() {},
};

await dispatchOpenclaw(
  'hub/health',
  { method: 'GET', headers: { authorization: `Bearer ${token}` } },
  res,
);
process.exit(body.includes('"ok":true') ? 0 : 1);
