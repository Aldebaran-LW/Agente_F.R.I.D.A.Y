import { handleOptions, requireAuth, setCors } from '../../../lib/auth.mjs';
import { runEcosystemWatch } from '../../../lib/heimdall-flow.mjs';

/** GET /openclaw/heimdall/flow — observador de fluxo */
export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  const data = await runEcosystemWatch();
  return res.status(data.ok ? 200 : 503).json(data);
}
