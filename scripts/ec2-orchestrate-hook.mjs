#!/usr/bin/env node
/**
 * Webhook EC2 — recebe tarefas encaminhadas pelo gateway Vercel (Friday).
 * EC2: node scripts/ec2-orchestrate-hook.mjs
 * Env: OPENCLAW_ORCHESTRATE_PORT=8790, OPENCLAW_INTERNAL_TOKEN (ou OPENCLAW_AUTOMATION_TOKEN)
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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
    const task = String(body.task || '').slice(0, 8000);
    const entry = {
      at: new Date().toISOString(),
      agent,
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
