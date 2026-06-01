#!/usr/bin/env node
/**
 * CLI Rebeca — Spaces HF + ferramentas de design.
 * Uso:
 *   node scripts/rebeca-design.mjs
 *   node scripts/rebeca-design.mjs --category 3d
 *   node scripts/rebeca-design.mjs --spaces-only
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  buildDesignScanReport,
  formatDesignTelegram,
  probeHfSpace,
} from './lib/rebeca-design-core.mjs';

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

const json = process.argv.includes('--json');
const spacesOnly = process.argv.includes('--spaces-only');
const catIdx = process.argv.indexOf('--category');
const category = catIdx >= 0 ? process.argv[catIdx + 1] : '';
const spaceIdx = process.argv.indexOf('--space');
const spaceId = spaceIdx >= 0 ? process.argv[spaceIdx + 1] : null;

async function main() {
  if (spaceId) {
    const r = await probeHfSpace(spaceId);
    console.log(json ? JSON.stringify(r, null, 2) : JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  }

  const report = await buildDesignScanReport({
    category,
    spaces: !spacesOnly,
    message: category ? `ferramentas design ${category}` : '',
  });

  console.log(json ? JSON.stringify(report, null, 2) : formatDesignTelegram(report));
  process.exit(report.ok ? 0 : 1);
}

main();
