#!/usr/bin/env node
/**
 * CLI Rimuru — consumo de tokens e monitorização.
 * Uso: node scripts/rimuru-tokens.mjs [--json] [--deploy]
 */
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import {
  buildTokenMonitorReport,
  formatMonitorTelegram,
  createTokenManager,
} from './lib/rimuru-token-core.mjs';
import { fetchDeployHealth } from '../gateway/lib/deploy.mjs';

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

loadEnv();

const json = process.argv.includes('--json');
const withDeploy = process.argv.includes('--deploy');

async function main() {
  let deploy = null;
  if (withDeploy) {
    try {
      deploy = await fetchDeployHealth();
    } catch (e) {
      deploy = { ok: false, error: String(e.message || e) };
    }
  }

  const report = await buildTokenMonitorReport({ deploy });
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatMonitorTelegram(report));
  }
  process.exit(report.ok ? 0 : 1);
}

if (process.argv.includes('--simulate')) {
  const m = createTokenManager({ usedTokens: 420_000 });
  console.log('Simulação:', m.status());
  process.exit(0);
}

main();
