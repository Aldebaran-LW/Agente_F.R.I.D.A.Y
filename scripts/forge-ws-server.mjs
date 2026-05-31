#!/usr/bin/env node
/**
 * Digital Forge — middleware (HTTP push + SSE + WebSocket opcional)
 * EC2: node scripts/forge-ws-server.mjs
 * POST /push  { "agent": "byte", "state": "compiling", "task": "api.ts" }
 * GET  /events  Server-Sent Events (recomendado no browser)
 * GET  /snapshot
 */
import http from 'http';

const PORT = Number(process.env.OPENCLAW_FORGE_WS_PORT || 8787);
const HOST = process.env.OPENCLAW_FORGE_WS_HOST || '127.0.0.1';

const ALIAS = {
  orchestrator: 'friday',
  heimdall: 'heimdall',
  veldora: 'veldora',
  odin: 'veldora',
  rimuru: 'rimuru',
  athena: 'rimuru',
  gideon: 'gideon',
  senku: 'gideon',
  yato: 'yato',
  sophia: 'yato',
  'vp-pecas': 'vp-pecas',
  macofel: 'macofel',
  ops: 'heimdall',
  byte: 'heimdall',
  pixel: 'vp-pecas',
  lala: 'macofel',
  main: 'friday',
  rebeca: 'rebeca',
  hefestos: 'hefestos',
  icaro: 'icaro',
  dedalo: 'dedalo',
};

const sseClients = new Set();
const agents = {};

function normalizeAgent(id) {
  const k = String(id || 'friday').toLowerCase();
  return ALIAS[k] || k;
}

function broadcast(payload) {
  const raw = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(raw);
    } catch {
      sseClients.delete(res);
    }
  }
}

function applyUpdate(body) {
  const agent = normalizeAgent(body.agent);
  const entry = {
    agent,
    state: String(body.state || 'idle').toLowerCase(),
    task: String(body.task || body.message || '').slice(0, 240),
    file: body.file ? String(body.file).slice(0, 120) : undefined,
    timestamp: Date.now(),
  };
  agents[agent] = entry;
  const payload = { type: 'agent', ...entry, agents: { ...agents } };
  broadcast(payload);
  return entry;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, sse: sseClients.size, agents }));
  }

  if (req.method === 'GET' && req.url === '/snapshot') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ agents }));
  }

  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'hello', agents: { ...agents } })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.method === 'POST' && req.url === '/push') {
    try {
      const body = await readBody(req);
      const entry = applyUpdate(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, ...entry }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: String(e.message) }));
    }
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, HOST, () => {
  console.log(`Digital Forge middleware`);
  console.log(`  SSE     http://${HOST}:${PORT}/events`);
  console.log(`  Push    http://${HOST}:${PORT}/push`);
  console.log(`  Painel  <gateway>/forge  → URL: http://${HOST}:${PORT}/events`);
});
