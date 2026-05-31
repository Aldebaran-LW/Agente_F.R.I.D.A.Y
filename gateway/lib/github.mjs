import { GITHUB_REPOS } from './portfolio-targets.mjs';

export async function fetchGithubStatus() {
  const owner = process.env.GITHUB_OWNER || 'Aldebaran-LW';
  const token = process.env.GITHUB_TOKEN;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'openclaw-gateway' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const repos = [];
  for (const name of GITHUB_REPOS) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      repos.push({ name, error: String(res.status) });
      continue;
    }
    const repo = await res.json();
    repos.push({
      name,
      pushed_at: repo.pushed_at,
      open_issues: repo.open_issues_count,
      homepage: repo.homepage,
    });
  }

  return { ok: true, owner, repos, at: new Date().toISOString() };
}
