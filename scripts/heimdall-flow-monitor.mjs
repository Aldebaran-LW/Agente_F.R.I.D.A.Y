#!/usr/bin/env node
/**
 * Heimdall — monitor de fluxo (one-shot para cron; NÃO loop infinito).
 *
 * Cron EC2 (cada 5 min) — ver docs/CRON-HEIMDALL-FLOW.md
 *
 * Uso local:
 *   node scripts/heimdall-flow-monitor.mjs
 *   node scripts/heimdall-flow-monitor.mjs --json
 *   node scripts/heimdall-flow-monitor.mjs --alert   # Hub se houver alertas
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  buildFlowMonitorReport,
  formatFlowTelegram,
  saveFlowSnapshot,
} from './lib/heimdall-flow-core.mjs';

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

async function persistAlerts(report) {
  if (!report.should_notify) return;
  try {
    const { isHubEnabled, persistLearning } = await import('../gateway/lib/hub-store.mjs');
    if (!isHubEnabled()) return;
    await persistLearning({
      agentId: 'heimdall',
      source: 'heimdall-flow-monitor',
      content: formatFlowTelegram(report),
      metadata: { type: 'flow_alert', alerts: report.alerts },
    });
  } catch (e) {
    console.warn('Hub:', e.message);
  }
}

async function main() {
  const json = process.argv.includes('--json');
  const quiet = process.argv.includes('--quiet');
  const doAlert = process.argv.includes('--alert');

  const report = await buildFlowMonitorReport();
  report.reply = formatFlowTelegram(report);
  saveFlowSnapshot(report);

  if (doAlert) await persistAlerts(report);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!quiet || report.should_notify) {
    console.log(report.reply);
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
