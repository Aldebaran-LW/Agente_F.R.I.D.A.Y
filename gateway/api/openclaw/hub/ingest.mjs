import { handleOptions, requireAuth, setCors } from '../../../lib/auth.mjs';
import { ingestHubRecord, isHubEnabled } from '../../../lib/hub-store.mjs';

const ALLOWED = new Set([
  'workflow_run',
  'snapshot',
  'learning',
  'approval_request',
  'approval_resolve',
  'session_touch',
]);

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

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

  if (!type || !ALLOWED.has(type)) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_type',
      allowed: [...ALLOWED],
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
