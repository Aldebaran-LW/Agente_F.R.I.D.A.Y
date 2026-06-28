#!/usr/bin/env node
/**
 * MCP stdio server — proxy read-only para o gateway OpenClaw (Cursor / Claude Code).
 *
 * Env: OPENCLAW_GATEWAY_BASE_URL, OPENCLAW_AUTOMATION_TOKEN (ou .env na raiz)
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'url';
import { MCP_READ_TOOLS, callMcpReadTool } from '../gateway/lib/mcp-tools.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const p of [join(root, '.env'), join(root, 'gateway', '.env')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) {
        process.env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

loadEnv();

const base = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
const token = process.env.OPENCLAW_AUTOMATION_TOKEN;
const useLocal = process.env.OPENCLAW_MCP_LOCAL === '1';

let buffer = Buffer.alloc(0);

function send(msg) {
  const body = JSON.stringify(msg);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}

function respond(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function respondError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function gwFetch(path) {
  if (!base || !token) {
    throw new Error('OPENCLAW_GATEWAY_BASE_URL ou OPENCLAW_AUTOMATION_TOKEN em falta');
  }
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const bypass = process.env.VERCEL_PROTECTION_BYPASS?.trim();
  if (bypass) headers['x-vercel-protection-bypass'] = bypass;
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, _raw: text.slice(0, 200), status: res.status };
  }
}

const REMOTE_MAP = {
  macofel_status: '/openclaw/macofel/status',
  github_aldebaran: '/openclaw/github/status',
  deploy_health: '/openclaw/deploy/health',
  vercel_status: '/openclaw/vercel/status',
  vp_pecas_health: '/openclaw/vp-pecas/health',
  icaro_validate: '/openclaw/mcp/call',
  rimuru_quotas: '/openclaw/rimuru/status',
};

async function callToolRemote(name, args) {
  if (name === 'icaro_validate') {
    const res = await fetch(`${base}/openclaw/mcp/call`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(process.env.VERCEL_PROTECTION_BYPASS
          ? { 'x-vercel-protection-bypass': process.env.VERCEL_PROTECTION_BYPASS }
          : {}),
      },
      body: JSON.stringify({ name: 'icaro_validate', arguments: args }),
    });
    const data = await res.json();
    return {
      content: [{ type: 'text', text: JSON.stringify(data.result ?? data, null, 2) }],
    };
  }
  const path = REMOTE_MAP[name];
  if (!path) throw new Error(`tool remota desconhecida: ${name}`);
  const data = await gwFetch(path);
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

async function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    respond(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'openclaw-readonly', version: '1.0.0' },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'tools/list') {
    respond(id, { tools: MCP_READ_TOOLS });
    return;
  }

  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments ?? {};
    try {
      const result = useLocal
        ? await callMcpReadTool(name, args)
        : await callToolRemote(name, args);
      respond(id, result);
    } catch (err) {
      respond(id, {
        content: [{ type: 'text', text: `Erro: ${err.message}` }],
        isError: true,
      });
    }
    return;
  }

  if (method === 'ping') {
    respond(id, {});
    return;
  }

  if (id !== undefined) {
    respondError(id, -32601, `Method not found: ${method}`);
  }
}

function onData(chunk) {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const header = buffer.slice(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }
    const len = Number(match[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + len) break;
    const body = buffer.slice(start, start + len).toString('utf8');
    buffer = buffer.slice(start + len);
    try {
      const msg = JSON.parse(body);
      handleMessage(msg).catch((err) => {
        if (msg.id !== undefined) respondError(msg.id, -32603, err.message);
      });
    } catch {
      /* ignore malformed */
    }
  }
}

process.stdin.on('data', onData);
process.stdin.resume();
