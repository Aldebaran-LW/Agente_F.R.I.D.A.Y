#!/usr/bin/env node
/**
 * Cron semanal — pipeline inovação (EC2).
 * Segunda 8h: ver docs/CRON-INOVACAO.md
 *
 *   node scripts/innovation-cron.mjs
 *   node scripts/innovation-cron.mjs --dry-run
 */
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
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
loadEnv();

const dryRun = process.argv.includes('--dry-run');
const topicSophia = process.env.INNOVATION_TOPIC_SOPHIA || 'IA devtools agentes openclaw';
const topicYato = process.env.INNOVATION_TOPIC_YATO || 'automação SaaS IA mercado';
const threshold = Number(process.env.GIDEON_THRESHOLD || 70);

function run(cmd, args) {
  return new Promise((res, rej) => {
    if (dryRun) {
      console.log('[dry-run]', cmd, args.join(' '));
      return res('');
    }
    const c = spawn(process.execPath, [cmd, ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { out += d; });
    c.on('close', (code) => (code === 0 ? res(out) : rej(new Error(out || `exit ${code}`))));
  });
}

async function main() {
  const log = { started: new Date().toISOString(), steps: [], alerts: [] };
  console.log('[Cron] Pipeline inovação…');

  try {
    await run(resolve(root, 'scripts/sophia-research.mjs'), ['--topic', topicSophia]);
    log.steps.push({ step: 'sophia', ok: true, topic: topicSophia });

    await run(resolve(root, 'scripts/yato-market-search.mjs'), ['--topic', topicYato]);
    log.steps.push({ step: 'yato', ok: true, topic: topicYato });

    await run(resolve(root, 'scripts/senku-process.mjs'), ['--topic', topicSophia]);
    log.steps.push({ step: 'senku', ok: true });

    const gOut = await run(resolve(root, 'scripts/gideon-predict.mjs'), ['--topic', topicSophia, '--json']);
    log.steps.push({ step: 'gideon', ok: true });

    let gideon = {};
    try {
      gideon = JSON.parse(gOut.trim());
    } catch {
      gideon = {};
    }
    const score = gideon.confianca_score ?? gideon.viabilidade_score ?? 0;
    const rec = gideon.recomendacao;
    if (score >= threshold && rec === 'hefestos') {
      const alert = {
        type: 'hefestos_candidate',
        score,
        topico: gideon.topico || topicSophia,
        message: `Gideon score ${score} — aguardar sim no Telegram antes de Hefestos --apply`,
      };
      log.alerts.push(alert);
      console.log('[Cron] ALERTA:', alert.message);
    }
  } catch (e) {
    log.error = e.message;
    console.error('[Cron] Falha:', e.message);
  }

  log.finished = new Date().toISOString();
  const logDir = resolve(root, 'data', 'innovation');
  mkdirSync(logDir, { recursive: true });
  writeFileSync(resolve(logDir, 'cron-last.json'), JSON.stringify(log, null, 2), 'utf8');
  console.log('[Cron] Log:', resolve(logDir, 'cron-last.json'));
}

main();
