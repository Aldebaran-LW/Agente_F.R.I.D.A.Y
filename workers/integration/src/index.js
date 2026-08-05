import { json, error } from './response.js';
import { requireAuth } from './auth.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!requireAuth(request, env)) return error('unauthorized', 401);

    if (request.method === 'GET' && (path === '/health' || path === '/')) {
      return json({
        ok: true, agent: 'integration', version: '1.0.0',
        services: ['meilisearch', 'khoj', 'apprise'],
        ec2Configured: !!env.EC2_HOST,
      });
    }

    if (!env.EC2_HOST) {
      return error('EC2_HOST not configured', 503);
    }

    if (path.startsWith('/search/')) {
      return handleSearch(request, env, path);
    }

    if (path.startsWith('/khoj/')) {
      return handleKhoj(request, env, path);
    }

    if (path.startsWith('/notify/')) {
      return handleNotify(request, env, path);
    }

    return error('not found', 404);
  },
};

async function handleSearch(request, env, path) {
  const subPath = path.replace(/^\/search/, '');
  const targetUrl = `${env.EC2_HOST}/search${subPath}${request.url.includes('?') ? '&' + new URL(request.url).search.slice(1) : ''}`;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (env.MEILI_MASTER_KEY) {
      headers.Authorization = `Bearer ${env.MEILI_MASTER_KEY}`;
    }

    const init = { method: request.method, headers };
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      init.body = await request.text().catch(() => '{}');
    }

    const res = await fetch(targetUrl, { ...init, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return error(`search proxy failed: ${e.message}`, 502);
  }
}

async function handleKhoj(request, env, path) {
  const subPath = path.replace(/^\/khoj/, '');
  const targetUrl = `${env.EC2_HOST}/khoj${subPath}${request.url.includes('?') ? '&' + new URL(request.url).search.slice(1) : ''}`;

  try {
    const headers = {};
    const ct = request.headers.get('Content-Type');
    if (ct) headers['Content-Type'] = ct;

    const init = { method: request.method, headers };
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      init.body = await request.arrayBuffer().catch(() => new ArrayBuffer(0));
    }

    const res = await fetch(targetUrl, { ...init, signal: AbortSignal.timeout(120000) });
    const body = await res.arrayBuffer();
    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    return error(`khoj proxy failed: ${e.message}`, 502);
  }
}

async function handleNotify(request, env, path) {
  const subPath = path.replace(/^\/notify/, '');
  const targetUrl = `${env.EC2_HOST}/notify${subPath}${request.url.includes('?') ? '&' + new URL(request.url).search.slice(1) : ''}`;

  try {
    const headers = { 'Content-Type': 'application/json' };
    const init = { method: request.method, headers };
    if (request.method === 'POST' || request.method === 'PUT') {
      init.body = await request.text().catch(() => '{}');
    }

    const res = await fetch(targetUrl, { ...init, signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return error(`notify proxy failed: ${e.message}`, 502);
  }
}
