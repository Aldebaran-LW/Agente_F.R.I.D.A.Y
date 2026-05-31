/** Ops deploy-monitor: Macofel apenas. VP usa skill vp-pecas-health. */
const SITES = [
  { key: 'macofel', env: 'MACOFEL_URL', default: 'https://macofel-2-0.vercel.app' },
];

export async function fetchDeployHealth() {
  const results = [];
  for (const site of SITES) {
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
