#!/usr/bin/env node
/**
 * Rimuru — monitor multi-provedor (alerta, NÃO bloqueia agentes).
 * Alias recomendado: node scripts/rimuru-token-monitor.mjs [--json] [--deploy]
 *
 * Também: node scripts/rimuru-tokens.mjs (mesmo núcleo)
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  buildTokenMonitorReport,
  formatMonitorTelegram,
  fetchOpenRouterKeyInfo,
} from './lib/rimuru-token-core.mjs';
import {
  checkAllProviders,
  summarizeProviders,
  providerAdvisories,
} from './lib/rimuru-providers.mjs';
import { fetchDeployHealth } from '../gateway/lib/deploy.mjs';

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
const withDeploy = process.argv.includes('--deploy');

async function main() {
  const providers = await checkAllProviders(fetchOpenRouterKeyInfo);
  let deploy = null;
  if (withDeploy) {
    try {
      deploy = await fetchDeployHealth();
    } catch (e) {
      deploy = { ok: false, error: String(e.message || e) };
    }
  }

  const report = await buildTokenMonitorReport({ deploy });
  report.providers = providers;
  report.provider_summary = summarizeProviders(providers);
  report.advisories = [
    ...providerAdvisories(providers),
    ...(report.advisories || []).filter((a) => !a.id?.startsWith('openrouter')),
  ];
  report.alert_only = true;
  report.reply = formatMonitorTelegramMulti(report);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(report.reply);
  }
  process.exit(report.ok ? 0 : 1);
}

function formatMonitorTelegramMulti(report) {
  const base = formatMonitorTelegram(report);
  const prov = (report.provider_summary || []).join('\n• ');
  return `${base}\n\nProvedores:\n• ${prov}`.slice(0, 1500);
}

main();
