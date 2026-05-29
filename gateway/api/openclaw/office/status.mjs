import { handleOptions, requireAuth, setCors } from '../../../lib/auth.mjs';
import { fetchOfficeSnapshot } from '../../../lib/office.mjs';
import { persistSnapshot } from '../../../lib/hub-store.mjs';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;

  const data = await fetchOfficeSnapshot();

  persistSnapshot('office', data, { ok: data.ok, source: 'gateway' }).catch((e) => {
    console.warn(JSON.stringify({ event: 'hub.snapshot_failed', kind: 'office', error: e.message }));
  });

  const status = data.ok ? 200 : 503;
  return res.status(status).json(data);
}
