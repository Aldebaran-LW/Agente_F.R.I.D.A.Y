import { VERCEL_PROJECT_FILTER } from './portfolio-targets.mjs';

export async function fetchVercelStatus() {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: 'VERCEL_API_TOKEN missing', at: new Date().toISOString() };
  }

  const team = process.env.VERCEL_TEAM_ID?.trim();
  const teamQ = team ? `teamId=${encodeURIComponent(team)}&` : '';
  const headers = { Authorization: `Bearer ${token}` };

  async function api(path) {
    const res = await fetch(`https://api.vercel.com${path}`, {
      headers,
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    return body;
  }

  try {
    const { projects = [] } = await api(`/v9/projects?${teamQ}limit=20`);
    const pick = projects.filter((p) => VERCEL_PROJECT_FILTER.test(p.name || ''));
    const list = (pick.length ? pick : projects).slice(0, 5);
    const out = { ok: true, at: new Date().toISOString(), projects: [] };

    for (const p of list) {
      let latest = null;
      try {
        const d = await api(`/v6/deployments?${teamQ}projectId=${p.id}&limit=1`);
        latest = d.deployments?.[0] ?? null;
      } catch {
        /* skip project */
      }
      out.projects.push({
        name: p.name,
        latest: latest
          ? { url: latest.url, state: latest.readyState || latest.state }
          : null,
      });
    }
    return out;
  } catch (e) {
    return { ok: false, error: String(e.message || e), at: new Date().toISOString() };
  }
}
