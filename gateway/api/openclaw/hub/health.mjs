import { handleOptions, requireAuth, setCors } from '../../../lib/auth.mjs';
import { isHubEnabled, supabasePing } from '../../../lib/hub-store.mjs';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

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
