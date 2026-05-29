import { handleOptions, requireAuth, setCors } from '../../../lib/auth.mjs';
import {
  fetchRecentHub,
  fetchLatestSnapshots,
  isHubEnabled,
  supabasePing,
} from '../../../lib/hub-store.mjs';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

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
