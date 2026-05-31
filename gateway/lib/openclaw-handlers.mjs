import { handleOptions, requireAuth, setCors } from './auth.mjs';
import { fetchDeployHealth } from './deploy.mjs';
import { fetchGithubStatus } from './github.mjs';
import {
  fetchRecentHub,
  fetchLatestSnapshots,
  ingestHubRecord,
  isHubEnabled,
  persistSnapshot,
  supabasePing,
} from './hub-store.mjs';
import { fetchMacofelStatus } from './macofel.mjs';
import { syncMacofelImages } from './macofel-sync.mjs';
import { fetchOfficeSnapshot } from './office.mjs';
import { forwardTask, listRoutes, resolveRoute } from './orchestrate.mjs';
import { fetchVercelStatus } from './vercel.mjs';
import { fetchVpPecasHealth } from './vp-pecas.mjs';

const HUB_INGEST_TYPES = new Set([
  'workflow_run',
  'snapshot',
  'learning',
  'approval_request',
  'approval_resolve',
  'session_touch',
]);

async function handleDeployHealth(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  const data = await fetchDeployHealth();
  return res.status(data.ok ? 200 : 503).json(data);
}

async function handleGithubStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  return res.status(200).json(await fetchGithubStatus());
}

async function handleHubHealth(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  if (!isHubEnabled()) {
    return res.status(200).json({
      ok: false,
      configured: false,
      error: 'supabase_not_configured',
    });
  }
  try {
    await supabasePing();
    return res.status(200).json({
      ok: true,
      configured: true,
      at: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      configured: true,
      error: err.message,
    });
  }
}

async function handleHubIngest(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  if (!isHubEnabled()) {
    return res.status(503).json({
      ok: false,
      error: 'supabase_not_configured',
      hint: 'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel',
    });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const type = body.type;
  const data = body.data ?? body;
  if (!type || !HUB_INGEST_TYPES.has(type)) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_type',
      allowed: [...HUB_INGEST_TYPES],
    });
  }
  try {
    const record = await ingestHubRecord(type, data);
    return res.status(201).json({
      ok: true,
      type,
      id: record?.id ?? null,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(JSON.stringify({ event: 'hub.ingest_failed', type, error: err.message }));
    return res.status(502).json({ ok: false, error: err.message });
  }
}

async function handleHubRecent(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  if (!isHubEnabled()) {
    return res.status(503).json({
      ok: false,
      error: 'supabase_not_configured',
    });
  }
  const limit = req.query?.limit ?? '20';
  const includeSnapshots = req.query?.snapshots !== '0';
  try {
    const recent = await fetchRecentHub({ limit });
    const snapshots = includeSnapshots ? await fetchLatestSnapshots() : null;
    return res.status(200).json({
      ok: true,
      hub: 'openclaw',
      at: new Date().toISOString(),
      ...recent,
      snapshots,
    });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message });
  }
}

async function handleMacofelStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  const data = await fetchMacofelStatus();
  return res.status(data.ok ? 200 : 503).json(data);
}

async function handleMacofelImagesSync(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const approved = Boolean(body.approved);
  if (!approved) {
    return res.status(403).json({
      ok: false,
      error: 'aprovacao_requerida',
      message: 'Envie approved: true apos sim/confirmar do Lucas',
    });
  }
  const data = await syncMacofelImages({
    ean: body.ean,
    imageUrls: body.imageUrls,
  });
  const status = data.ok ? 200 : data.status === 401 ? 401 : 502;
  return res.status(status).json(data);
}

async function handleOfficeStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  const data = await fetchOfficeSnapshot();
  persistSnapshot('office', data, { ok: data.ok, source: 'gateway' }).catch((e) => {
    console.warn(JSON.stringify({ event: 'hub.snapshot_failed', kind: 'office', error: e.message }));
  });
  return res.status(data.ok ? 200 : 503).json(data);
}

async function handleOrchestrate(req, res) {
  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    return res.status(200).json({
      ok: true,
      service: 'friday-orchestrate',
      role: 'gateway broker — nao executa tarefas longas',
      timeoutMs: Number(process.env.ORCHESTRATE_TIMEOUT_MS || 8000),
      agents: listRoutes(),
    });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const agent = body.agent || body.agent_id;
  const task = body.task || body.message || body.text || '';
  if (!agent) {
    return res.status(400).json({ ok: false, error: 'agent required' });
  }
  if (!task) {
    return res.status(400).json({ ok: false, error: 'task required' });
  }
  const preview = resolveRoute(agent);
  if (!preview) {
    return res.status(404).json({ ok: false, error: 'agent not found', agent });
  }
  const result = await forwardTask(agent, task, { async: Boolean(body.async) });
  const status = result.ok ? 200 : result.status || 502;
  return res.status(status).json({
    ok: result.ok,
    agent,
    residence: preview.target,
    mode: preview.mode,
    ...result,
  });
}

async function handleVercelStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  const data = await fetchVercelStatus();
  return res.status(data.ok ? 200 : 503).json(data);
}

async function handleVpPecasHealth(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  const data = await fetchVpPecasHealth();
  return res.status(data.ok ? 200 : 503).json(data);
}

export const OPENCLAW_ROUTES = {
  'deploy/health': handleDeployHealth,
  'github/status': handleGithubStatus,
  'hub/health': handleHubHealth,
  'hub/ingest': handleHubIngest,
  'hub/recent': handleHubRecent,
  'macofel/status': handleMacofelStatus,
  'macofel/images/sync': handleMacofelImagesSync,
  'office/status': handleOfficeStatus,
  orchestrate: handleOrchestrate,
  'vercel/status': handleVercelStatus,
  'vp-pecas/health': handleVpPecasHealth,
};

export async function dispatchOpenclaw(route, req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const handler = OPENCLAW_ROUTES[route];
  if (!handler) {
    return res.status(404).json({ ok: false, error: 'route not found', route });
  }
  return handler(req, res);
}