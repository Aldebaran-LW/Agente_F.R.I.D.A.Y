import { dispatchOpenclaw } from '../../lib/openclaw-handlers.mjs';

export default async function handler(req, res) {
  const raw = req.query?.path;
  const route = Array.isArray(raw) ? raw.join('/') : String(raw || '').trim();
  return dispatchOpenclaw(route, req, res);
}