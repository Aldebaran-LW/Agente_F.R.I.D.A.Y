import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 7860);
const KEEPALIVE_MS = Number(process.env.KEEPALIVE_MS || 240000);
const gatewayBase = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
const gatewayToken = process.env.OPENCLAW_AUTOMATION_TOKEN?.trim();

let lastStatus = null;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

async function fetchGateway(path) {
  if (!gatewayBase) return { ok: false, error: 'OPENCLAW_GATEWAY_BASE_URL not set' };
  const headers = { Accept: 'application/json' };
  if (gatewayToken) headers.Authorization = `Bearer ${gatewayToken}`;
  const res = await fetch(`${gatewayBase}${path}`, { headers, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, body };
}

async function buildStatus() {
  const demo = { ok: true, service: 'openclaw-hf-demo', at: new Date().toISOString() };
  let health = null;
  let office = null;
  if (gatewayBase) {
    health = await fetchGateway('/api/health');
    if (gatewayToken) {
      const o = await fetchGateway('/openclaw/office/status');
      office = o.body;
    }
  }
  const payload = {
    ok: demo.ok && (!gatewayBase || health?.ok),
    demo,
    gatewayConfigured: Boolean(gatewayBase),
    gateway: gatewayBase ? { base: gatewayBase, health, office } : null,
    office,
    at: new Date().toISOString(),
  };
  lastStatus = payload;
  return payload;
}

function serveFile(res, relPath, contentType) {
  const p = join(__dirname, relPath);
  if (!existsSync(p)) {
    json(res, 404, { ok: false, error: 'not found' });
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(readFileSync(p));
}

createServer(async (req, res) => {
  const path = req.url?.split('?')[0] || '/';

  if (path === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'openclaw-hf-demo',
      gatewayConfigured: Boolean(gatewayBase),
      keepaliveMs: KEEPALIVE_MS,
      at: new Date().toISOString(),
    });
  }

  if (path === '/api/status') {
    try {
      const data = await buildStatus();
      return json(res, data.ok ? 200 : 502, data);
    } catch (e) {
      return json(res, 502, { ok: false, error: String(e.message) });
    }
  }

  if (path === '/gateway') {
    try {
      const data = await buildStatus();
      return json(res, data.gateway?.health?.ok ? 200 : 502, data);
    } catch (e) {
      return json(res, 502, { ok: false, error: String(e.message) });
    }
  }

  if (path === '/' || path === '/index.html') {
    return serveFile(res, 'public/dashboard.html', 'text/html; charset=utf-8');
  }

  json(res, 404, { ok: false, error: 'not found' });
}).listen(PORT, '0.0.0.0', () => {
  console.log('openclaw-hf-demo on ' + PORT + ' keepalive=' + KEEPALIVE_MS + 'ms');
});

if (KEEPALIVE_MS > 0) {
  setInterval(() => {
    buildStatus().then(() => {
      console.log(JSON.stringify({ event: 'keepalive', at: lastStatus?.at }));
    }).catch((e) => {
      console.warn(JSON.stringify({ event: 'keepalive_error', error: e.message }));
    });
  }, KEEPALIVE_MS);
}
