#!/usr/bin/env node
/**
 * Envia lembretes WhatsApp vencidos (Twilio).
 * Cron / heartbeat: node scripts/scheduled-whatsapp-dispatch.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchDue } from './lib/scheduled-whatsapp-core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

loadEnv();

const dryRun = process.argv.includes('--dry-run');

const result = await dispatchDue({ dryRun });
console.log(
  JSON.stringify(
    {
      ok: result.ok,
      sent: result.sent,
      failed: result.failed,
      error: result.error,
      dryRun,
    },
    null,
    2
  )
);
process.exit(result.failed > 0 ? 1 : 0);
