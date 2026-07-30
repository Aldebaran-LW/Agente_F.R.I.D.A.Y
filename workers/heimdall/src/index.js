import { json, error } from './response.js';
import { requireAuth } from './auth.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!requireAuth(request, env)) return error('unauthorized', 401);

    if (path === '/github/status') return handleGithub(env);
    if (path === '/deploy/health') return handleDeploy(env);
    if (path === '/vp-pecas/health') return handleVpPecas(env);
    if (path === '/health') return json({ ok: true, agent: 'heimdall', version: '2.0.0-cf' });

    return error('not found', 404);
  },
};

async function handleGithub(env) {
  if (!env.GITHUB_TOKEN) {
    return json({ ok: false, error: 'GITHUB_TOKEN not configured' }, 503);
  }

  const repos = (env.GITHUB_REPOS || 'Macofel_2.0,VP-Pecas,vp-precision-studio').split(',').map(r => r.trim());
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.GITHUB_TOKEN}` };
  const results = [];

  for (const repo of repos) {
    try {
      const res = await fetch(`https://api.github.com/repos/Aldebaran-LW/${repo}`, { headers, signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      results.push({
        repo, ok: res.ok,
        stars: data.stargazers_count, forks: data.forks_count,
        issues: data.open_issues_count, archived: data.archived,
      });
    } catch (e) {
      results.push({ repo, ok: false, error: e.message });
    }
  }

  return json({ ok: true, at: new Date().toISOString(), repos: results });
}

async function handleDeploy(env) {
  const targets = [
    { name: 'gateway', url: env.OPENCLAW_GATEWAY_BASE_URL || 'https://openclaw.lwdigitalforge.com' },
  ];

  if (env.VERCEL_API_TOKEN) {
    targets.push({ name: 'vercel', url: 'https://api.vercel.com/v9/projects' });
  }

  const results = [];
  for (const target of targets) {
    try {
      const headers = {};
      if (target.name === 'vercel' && env.VERCEL_API_TOKEN) {
        headers.Authorization = `Bearer ${env.VERCEL_API_TOKEN}`;
      }
      const res = await fetch(target.url, { headers, signal: AbortSignal.timeout(10000) });
      results.push({ name: target.name, ok: res.ok, status: res.status });
    } catch (e) {
      results.push({ name: target.name, ok: false, error: e.message });
    }
  }

  return json({ ok: results.some(r => r.ok), at: new Date().toISOString(), services: results });
}

async function handleVpPecas(env) {
  const urls = [];
  if (env.VP_PECAS_URL) urls.push({ name: 'vp-pecas', url: env.VP_PECAS_URL });
  if (env.VP_PRECISION_URL) urls.push({ name: 'vp-precision', url: env.VP_PRECISION_URL });

  if (!urls.length) {
    return json({ ok: false, error: 'no URLs configured' }, 503);
  }

  const results = [];
  for (const site of urls) {
    try {
      const res = await fetch(site.url, { signal: AbortSignal.timeout(10000) });
      results.push({ name: site.name, ok: res.ok, status: res.status, ms: 0 });
    } catch (e) {
      results.push({ name: site.name, ok: false, error: e.message });
    }
  }

  return json({ ok: results.every(r => r.ok), at: new Date().toISOString(), sites: results });
}


