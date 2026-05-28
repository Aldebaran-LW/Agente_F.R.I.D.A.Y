import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || 7860);
const gatewayBase = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
const gatewayToken = process.env.OPENCLAW_AUTOMATION_TOKEN?.trim();

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
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
  return { ok: res.ok, status: res.status, body };
}

const html = '<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/><title>OpenClaw Demo</title></head><body><h1>OpenClaw Demo</h1><p><a href="/health">/health</a> | <a href="/gateway">/gateway</a></p></body></html>';

createServer(async (req, res) => {
  const path = req.url?.split('?')[0] || '/';
  if (path === '/health') {
    return json(res, 200, { ok: true, service: 'openclaw-hf-demo', gatewayConfigured: Boolean(gatewayBase), at: new Date().toISOString() });
  }
  if (path === '/gateway') {
    try {
      const health = await fetchGateway('/api/health');
      let office = null;
      if (gatewayToken) office = await fetchGateway('/openclaw/office/status');
      return json(res, health.ok ? 200 : 502, { ok: health.ok, gateway: gatewayBase || null, health, office });
    } catch (e) {
      return json(res, 502, { ok: false, error: String(e.message) });
    }
  }
  if (path === '/' || path === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  json(res, 404, { ok: false, error: 'not found' });
}).listen(PORT, '0.0.0.0', () => console.log('openclaw-hf-demo on ' + PORT));