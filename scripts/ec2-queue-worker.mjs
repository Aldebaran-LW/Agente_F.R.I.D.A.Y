#!/usr/bin/env node
/**
 * Queue Worker — processa tarefas da fila do ec2-orchestrate-hook.
 * Roda como daemon companion ao hook.
 *
 *   node scripts/ec2-queue-worker.mjs
 *   node scripts/ec2-queue-worker.mjs --once
 *   node scripts/ec2-queue-worker.mjs --dry-run
 *
 * Env:
 *   EC2_QUEUE_POLL_INTERVAL_MS=10000
 *   EC2_QUEUE_HOOK_URL=http://127.0.0.1:8790
 *   EC2_QUEUE_AUTH_TOKEN=
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const POLL_INTERVAL = Number(process.env.EC2_QUEUE_POLL_INTERVAL_MS || 10000);
const HOOK_URL = process.env.EC2_QUEUE_HOOK_URL || 'http://127.0.0.1:8790';
const AUTH_TOKEN = process.env.EC2_QUEUE_AUTH_TOKEN || process.env.OPENCLAW_AUTOMATION_TOKEN || '';
const ONCE = process.argv.includes('--once');
const DRY_RUN = process.argv.includes('--dry-run');

const PROCESSED_LOG = resolve(ROOT, 'data', 'queue-processed.json');
const MAX_PROCESSED = 200;

function log(...args) {
  console.log(`[QueueWorker ${new Date().toISOString()}]`, ...args);
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: { ...options.headers },
      timeout: 10000,
    };
    if (AUTH_TOKEN) {
      opts.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch {
          reject(new Error('invalid json response'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

function runScript(script, args = []) {
  return new Promise((resolve, reject) => {
    if (DRY_RUN) {
      log(`[dry-run] node ${script} ${args.join(' ')}`);
      return resolve({ ok: true, dryRun: true });
    }
    const proc = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let out = '';
    proc.stdout.on('data', (d) => { out += d; });
    proc.stderr.on('data', (d) => { out += d; });
    proc.on('close', (code) => {
      if (code === 0) return resolve({ ok: true, output: out.trim() });
      reject(new Error(out.trim() || `exit ${code}`));
    });
    proc.on('error', reject);
  });
}

async function processQueue() {
  let queue;
  try {
    queue = await fetchJson(`${HOOK_URL}/queue`);
  } catch (e) {
    log('ERRO ao consultar fila:', e.message);
    return;
  }
  if (!queue.ok || !Array.isArray(queue.queue) || queue.queue.length === 0) return;

  let processed = [];
  try {
    const fs = await import('node:fs');
    if (fs.existsSync(PROCESSED_LOG)) {
      processed = JSON.parse(fs.readFileSync(PROCESSED_LOG, 'utf8'));
    }
  } catch { /* ignore */ }
  const processedIds = new Set(processed.map((p) => p.at));

  for (const entry of queue.queue) {
    if (processedIds.has(entry.at)) continue;

    log(`Processando: agent=${entry.agent} skill=${entry.skill || 'default'}`);

    let result;
    const agent = entry.agent?.toLowerCase();
    const skill = entry.skill?.toLowerCase();

    try {
      if (agent === 'orchestrator' || agent === 'jarvis') {
        if (entry.task?.startsWith('ping') || entry.task === 'test') {
          result = { ok: true, detail: 'pong' };
        } else {
          result = { ok: true, detail: 'ack' };
        }
      } else if (skill === 'macofel-status') {
        const r = await runScript(resolve(ROOT, 'scripts/macofel-status.js'));
        result = { ok: r.ok, detail: r.output };
      } else if (skill === 'github-aldebaran' || agent === 'heimdall') {
        const r = await runScript(resolve(ROOT, 'scripts/github-repo-status.js'));
        result = { ok: r.ok, detail: r.output };
      } else if (skill === 'vp-pecas-health' || agent === 'vp-pecas') {
        result = { ok: true, detail: 'delegado Vercel' };
      } else {
        result = { ok: true, detail: `agent=${agent} skill=${skill} enfileirado` };
      }
    } catch (e) {
      log(`Falha ao processar ${agent}:`, e.message);
      result = { ok: false, error: e.message };
    }

    log(`Resultado ${agent}:`, result.ok ? 'OK' : 'FALHA');
    processed.push({ at: entry.at, agent: entry.agent, skill: entry.skill, result });
    if (processed.length > MAX_PROCESSED) processed = processed.slice(-MAX_PROCESSED);
  }

  try {
    const fs = await import('node:fs');
    const dir = resolve(ROOT, 'data');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROCESSED_LOG, JSON.stringify(processed, null, 2), 'utf8');
  } catch { /* ignore */ }
}

async function main() {
  log('Queue Worker iniciado (poll interval:', POLL_INTERVAL, 'ms)');
  log('Hook URL:', HOOK_URL);
  if (DRY_RUN) log('Modo: DRY RUN');

  if (ONCE) {
    await processQueue();
    log('Execução única concluída.');
    return;
  }

  while (true) {
    await processQueue();
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

main().catch((e) => {
  console.error('[QueueWorker] Fatal:', e.message);
  process.exit(1);
});
