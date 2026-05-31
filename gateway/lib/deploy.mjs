import { DEPLOY_SITES } from './portfolio-targets.mjs';

/** Ops deploy-monitor: Macofel + portal LW Digital Forge. VP usa skill vp-pecas-health. */

export async function fetchDeployHealth() {
  const results = [];
  for (const site of DEPLOY_SITES) {
    const url = process.env[site.env]?.trim() || site.default;
    if (!url) continue;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      const ms = Date.now() - start;
      const ok = res.status >= 200 && res.status < 400;
      results.push({ site: site.key, url, status: res.status, ms, ok });
    } catch (e) {
      results.push({ site: site.key, url, ok: false, error: String(e.message || e) });
    }
  }
  const allOk = results.every((r) => r.ok);
  return { ok: allOk, sites: results, at: new Date().toISOString() };
}
