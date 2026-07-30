import { json, error } from './response.js';
import { requireAuth } from './auth.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!requireAuth(request, env)) return error('unauthorized', 401);

    if (request.method === 'GET' && (path === '/' || path === '/status')) {
      return handleStatus(env);
    }

    if (request.method === 'POST' && path === '/images/sync') {
      return handleImagesSync(request, env);
    }

    return error('not found', 404);
  },
};

async function handleStatus(env) {
  const ec2Health = await checkEc2(env);
  const mongoViaEc2 = await checkMongoViaEc2(env);

  return json({
    ok: mongoViaEc2.ok || ec2Health.ok,
    at: new Date().toISOString(),
    source: mongoViaEc2.ok ? 'mongodb' : ec2Health.ok ? 'ec2' : 'none',
    ec2: ec2Health,
    mongodb: mongoViaEc2,
  }, mongoViaEc2.ok ? 200 : ec2Health.ok ? 200 : 503);
}

async function checkEc2(env) {
  try {
    const res = await fetch('http://18.191.36.145:8790/health', { signal: AbortSignal.timeout(5000) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, ...data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function checkMongoViaEc2(env) {
  const token = env.OPENCLAW_AUTOMATION_TOKEN;
  try {
    const res = await fetch(`${env.OPENCLAW_GATEWAY_BASE_URL || 'https://openclaw.lwdigitalforge.com'}/openclaw/macofel/status`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return data;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function handleImagesSync(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.approved) {
    return json({ ok: false, error: 'aprovacao_requerida' }, 403);
  }

  const ean = String(body.ean || '').trim();
  const urls = (Array.isArray(body.imageUrls) ? body.imageUrls : []).map(u => String(u).trim()).filter(Boolean);
  if (!ean || !urls.length) return error('ean e imageUrls obrigatorios', 400);

  try {
    const token = env.OPENCLAW_AUTOMATION_TOKEN;
    const res = await fetch(`${env.OPENCLAW_GATEWAY_BASE_URL || 'https://openclaw.lwdigitalforge.com'}/openclaw/macofel/images/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ean, imageUrls: urls, approved: true }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return json(data, res.ok ? 200 : 502);
  } catch (e) {
    return error(`sync failed: ${e.message}`, 502);
  }
}
