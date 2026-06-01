import { handleOptions, requireAuth, setCors } from '../../../lib/auth.mjs';
import { runInnovationMonitor } from '../../../lib/rimuru.mjs';

/** GET /openclaw/rimuru/status — quotas e monitor (Rimuru). */
export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;

  const data = await runInnovationMonitor({ deploy: req.query?.deploy !== '0' });
  return res.status(data.ok ? 200 : 503).json(data);
}
