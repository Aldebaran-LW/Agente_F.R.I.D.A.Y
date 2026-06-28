#!/usr/bin/env node
/**
 * Suite Ícaro — validadores locais pós-mudança (configs, rotas Jarvis, gateway live).
 *
 * Uso:
 *   node scripts/icaro-test-suite.mjs           # validate + slash routes
 *   node scripts/icaro-test-suite.mjs --all     # + test-all-logic (precisa .env)
 *   node scripts/icaro-test-suite.mjs --gateway # só test-all-logic
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const all = args.has('--all');
const gatewayOnly = args.has('--gateway');
const quick = args.has('--quick') || (!all && !gatewayOnly);

function runScript(name, extraArgs = []) {
  const scriptPath = join(root, 'scripts', name);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ms = Date.now() - t0;
  const ok = r.status === 0;
  const detail = ok
    ? `${ms}ms`
    : (r.stderr || r.stdout || `exit ${r.status}`).trim().split('\n').slice(-3).join(' | ');
  return { name, ok, ms, detail };
}

console.log('=== ICARO TEST SUITE ===\n');

const steps = [];
if (quick || all) {
  steps.push(runScript('validate-agent-config.mjs'));
  steps.push(runScript('test-slash-routes.mjs'));
}
if (gatewayOnly || all) {
  steps.push(runScript('test-all-logic.mjs'));
}

for (const s of steps) {
  console.log(`  [${s.ok ? 'OK' : 'FALHA'}] ${s.name} — ${s.detail}`);
}

const failed = steps.filter((s) => !s.ok);
console.log(
  failed.length
    ? `\n${failed.length}/${steps.length} falha(s).\n`
    : `\n${steps.length}/${steps.length} OK.\n`
);

process.exit(failed.length ? 1 : 0);
