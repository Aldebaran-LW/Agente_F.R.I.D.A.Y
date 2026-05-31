#!/usr/bin/env node
/**
 * Webhook EC2 — recebe tarefas encaminhadas pelo gateway Vercel (Friday).
 * EC2: node scripts/ec2-orchestrate-hook.mjs
 * Env: OPENCLAW_ORCHESTRATE_PORT=8790, OPENCLAW_INTERNAL_TOKEN (ou OPENCLAW_AUTOMATION_TOKEN)
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PORT = Number(process.env.OPENCLAW_ORCHESTRATE_PORT || 8790);
const HOST = process.env.OPENCLAW_ORCHESTRATE_HOST || '127.0.0.1';

function loadOpenClawEnv() {
  const p = join(homedir(), '.openclaw', '.env');
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
loadOpenClawEnv();

const TOKEN = (process.env.OPENCLAW_INTERNAL_TOKEN || process.env.OPENCLAW_AUTOMATION_TOKEN || '').trim();

const queue = [];

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

function authorized(req) {
  if (!TOKEN) return true;
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  return t === TOKEN;
}

function runMacofelImagesSync(params = {}, approved = false) {
  const ean = String(params.ean || '').trim();
  const urls = (Array.isArray(params.imageUrls) ? params.imageUrls : [])
    .map((u) => String(u).trim())
    .filter(Boolean);
  if (!approved) {
    return { ok: false, error: 'approval_required' };
  }
  if (!ean || !urls.length) {
    return { ok: false, error: 'ean e imageUrls obrigatorios' };
  }
  const script = join(ROOT, 'scripts', 'macofel-images-sync.js');
  const args = ['--ean', ean, '--urls', urls.join(','), '--approved'];
  const run = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  try {
    return JSON.parse(run.stdout || '{}');
  } catch {
    return {
      ok: false,
      error: run.stderr?.trim() || run.stdout?.trim() || 'sync script failed',
      code: run.status,
    };
  }
}

const server = http.createServer(async (req, res) => {
  const path = req.url?.split('?')[0] || '/';

  if (path === '/health') {
    return json(res, 200, { ok: true, service: 'ec2-orchestrate-hook', queued: queue.length });
  }

  if (path === '/task' && req.method === 'POST') {
    if (!authorized(req)) return json(res, 401, { ok: false, error: 'unauthorized' });

    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      return json(res, 400, { ok: false, error: 'invalid json' });
    }

    const agent = String(body.agent || 'orchestrator').toLowerCase();
    const skill = String(body.skill || '').trim();
    const task = String(body.task || '').slice(0, 8000);
    const params = body.params || {};
    const approved = Boolean(body.approved);

    if (skill === 'macofel-images-sync' || (agent === 'macofel' && /sync imagem/i.test(task))) {
      const result = runMacofelImagesSync(
        { ean: params.ean || body.ean, imageUrls: params.imageUrls || body.imageUrls },
        approved || Boolean(params.approved)
      );
      return json(res, result.ok ? 200 : 502, {
        ok: result.ok,
        skill: 'macofel-images-sync',
        agent: 'macofel',
        result,
      });
    }

    const entry = {
      at: new Date().toISOString(),
      agent,
      skill: skill || null,
      task,
      source: body.source || 'gateway',
      async: Boolean(body.async),
    };
    queue.push(entry);
    if (queue.length > 100) queue.shift();

    console.log(JSON.stringify({ event: 'orchestrate_task', ...entry }));

    return json(res, 202, {
      ok: true,
      accepted: true,
      agent,
      message: 'Tarefa na fila EC2 — Jarvis/OpenClaw processa via daemon ou cron',
      hint: 'Integrar com openclaw gateway local ou Telegram bridge',
      queueSize: queue.length,
    });
  }

  if (path === '/queue' && req.method === 'GET') {
    if (!authorized(req)) return json(res, 401, { ok: false, error: 'unauthorized' });
    return json(res, 200, { ok: true, queue: queue.slice(-20) });
  }

  json(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`ec2-orchestrate-hook http://${HOST}:${PORT} (POST /task)`);
});
