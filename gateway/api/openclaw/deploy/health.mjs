import { handleOptions, requireAuth, setCors } from '../../../lib/auth.mjs';
import { fetchDeployHealth } from '../../../lib/deploy.mjs';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;

  const data = await fetchDeployHealth();
  const status = data.ok ? 200 : 503;
  return res.status(status).json(data);
}
