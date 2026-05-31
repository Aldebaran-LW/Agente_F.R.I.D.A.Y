import { dispatchOpenclaw } from '../lib/openclaw-handlers.mjs';

function resolveRoute(req) {
  let route = req.query?.route;
  if (Array.isArray(route)) route = route.join('/');
  route = String(route || '').trim();
  if (route) return route;
  const m = String(req.url || '').match(/[?&]route=([^&]+)/);
  if (m) return decodeURIComponent(m[1]);
  return '';
}

export default async function handler(req, res) {
  const route = resolveRoute(req);
  if (!route) {
    return res.status(400).json({ ok: false, error: 'route required' });
  }
  return dispatchOpenclaw(route, req, res);
}