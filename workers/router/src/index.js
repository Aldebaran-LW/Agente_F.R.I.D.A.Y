import { json, error, handleOptions } from './response.js';
import { requireAuth } from './auth.js';

const AGENT_ROUTES = {
  'macofel/status':   { binding: 'macofel', path: '/status' },
  'macofel/images':   { binding: 'macofel', path: '/images/sync' },
  'github/status':    { binding: 'heimdall', path: '/github/status' },
  'deploy/health':    { binding: 'heimdall', path: '/deploy/health' },
  'vp-pecas/health':  { binding: 'heimdall', path: '/vp-pecas/health' },
  'jarvis':           { binding: 'jarvis', path: '/jarvis' },
  'innovation':       { binding: 'innovation', path: '/status' },
  'health':           { binding: null, path: null },
  'office':           { binding: null, path: null },
};

export default {
  async fetch(request, env, ctx) {
    const opt = handleOptions(request);
    if (opt) return opt;

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');
    const agent = resolveAgent(path);

    if (!agent) return error('route not found', 404);

    if (agent.auth && !requireAuth(request, env)) {
      return error('unauthorized', 401);
    }

    if (path === 'health') {
      return json({
        ok: true, agent: 'openclaw-router', version: '2.0.0-cloudflare',
        agents: Object.keys(AGENT_ROUTES).filter(k => k !== 'health'),
      });
    }

    if (path.startsWith('office') || path.startsWith('forge') || path.startsWith('friday')) {
      return serveStatic(env, path);
    }

    if (!agent.binding) return error('route not available', 503);

    return forwardToAgent(request, env, agent);
  },
};

function resolveAgent(path) {
  if (path === 'health') return { binding: null, path: null, auth: false };
  for (const [prefix, config] of Object.entries(AGENT_ROUTES)) {
    if (prefix === 'health') continue;
    if (path === prefix || path.startsWith(prefix + '/')) {
      return { ...config, auth: true };
    }
  }
  return null;
}

async function forwardToAgent(request, env, agent) {
  const binding = env[agent.binding.toUpperCase()];
  if (!binding) return error(`${agent.binding} agent not configured`, 503);

  const newUrl = new URL(request.url);
  newUrl.pathname = agent.path;
  const forwarded = new Request(newUrl, request);
  forwarded.headers.set('X-Forwarded-By', 'openclaw-router');

  try {
    return await binding.fetch(forwarded);
  } catch (e) {
    return error(`upstream error: ${e.message}`, 502);
  }
}

async function serveStatic(env, path) {
  if (env.ASSETS) {
    return env.ASSETS.fetch(new Request(`https://assets/${path}`));
  }
  return json({ ok: false, error: 'static assets not configured' }, 503);
}


