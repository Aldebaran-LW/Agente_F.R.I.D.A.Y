import { handleOptions, requireAuth, setCors } from '../../../lib/auth.mjs';
import { fetchInnovationStatus } from '../../../lib/innovation-status.mjs';

/** GET /openclaw/innovation/status — resumo pipeline (data/innovation local ou EC2). */
export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;

  const days = Number(req.query?.days) || 7;
  const data = await fetchInnovationStatus({ days });
  return res.status(data.ok ? 200 : 503).json(data);
}
