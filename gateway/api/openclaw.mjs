import { dispatchOpenclaw } from '../lib/openclaw-handlers.mjs';

function resolveRoute(req) {
  let route = req.query?.route;
  if (Array.isArray(route)) route = route.join('/');
  if (route) return String(route).trim();

  const raw = req.url || '';
  const path = raw.split('?')[0];
  return path.replace(/^\/api\/openclaw\/?/, '').trim();
}

export default async function handler(req, res) {
  return dispatchOpenclaw(resolveRoute(req), req, res);
}