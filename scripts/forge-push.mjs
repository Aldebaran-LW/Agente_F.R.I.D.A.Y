#!/usr/bin/env node
/** Envia estado para o Digital Forge (HTTP /push) */
const base = (process.env.OPENCLAW_FORGE_PUSH_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const agent = process.argv[2] || 'friday';
const state = process.argv[3] || 'idle';
const task = process.argv.slice(4).join(' ') || '';

const body = { agent, state, task };
const res = await fetch(`${base}/push`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Falha', res.status, json);
  process.exit(1);
}
console.log('OK', json);
