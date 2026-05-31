#!/usr/bin/env node
/** HF_TOKEN na Vercel (API) ou instrucoes se token limited. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(resolve(root, '.env'))) { console.error('Falta .env'); process.exit(1); }
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('='); const k = t.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const token = process.env.VERCEL_API_TOKEN?.trim();
const hfToken = process.env.HF_TOKEN?.trim();
const teamId = 'team_RZX8P6bxuYn7Aqq2jLgZ7Txm';
const projectId = 'prj_m66Z8wWFqgUQBqfejjcRA1nhqkXP';
if (!token || !hfToken) { console.error('Falta VERCEL_API_TOKEN ou HF_TOKEN'); process.exit(1); }
console.log('HF_FRIDAY_PROD_URL via gateway/vercel.json\n');
const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'HF_TOKEN', value: hfToken, type: 'encrypted', target: ['production','preview','development'] }),
});
if (res.ok || res.status === 409) { console.log('[OK] HF_TOKEN na Vercel'); process.exit(0); }
console.error('[AVISO] HF_TOKEN nao gravado (token limited?). Colar em:');
console.error('https://vercel.com/lucas-willians-projects-506f0514/agente-openclaw/settings/environment-variables');
process.exit(1);