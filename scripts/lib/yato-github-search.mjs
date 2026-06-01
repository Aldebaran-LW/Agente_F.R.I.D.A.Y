/**
 * Yato — pesquisa no GitHub (Search API, não scraping de trending HTML).
 */
import { isAllowedSource } from '../../agents/veldora/validate-sources.mjs';

/**
 * @param {string} topic
 * @param {number} limit
 */
export async function searchGithubRepos(topic, limit = 10) {
  const token = process.env.GITHUB_TOKEN?.trim();
  const q = encodeURIComponent(`${topic} in:name,description,readme`);
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${Math.min(limit, 30)}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'OpenClaw-Yato',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: body.message || String(res.status),
      items: [],
    };
  }

  const items = (body.items || []).map((r) => {
    const link = r.html_url;
    return {
      nome: r.full_name,
      stars: r.stargazers_count,
      linguagem: r.language,
      link,
      link_ok: isAllowedSource(link),
      descricao: (r.description || '').slice(0, 200),
      atualizado: r.updated_at,
      topics: (r.topics || []).slice(0, 5),
    };
  });

  return { ok: true, total_count: body.total_count, items };
}

/**
 * Repos em alta na org Aldebaran-LW (complemento à pesquisa por tópico).
 */
export async function searchGithubOrgRepos(org = 'Aldebaran-LW', limit = 10) {
  const token = process.env.GITHUB_TOKEN?.trim();
  const url = `https://api.github.com/orgs/${org}/repos?sort=updated&per_page=${Math.min(limit, 30)}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'OpenClaw-Yato',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  const body = await res.json().catch(() => []);
  if (!res.ok) {
    return { ok: false, error: String(res.status), items: [] };
  }
  const list = Array.isArray(body) ? body : [];
  return {
    ok: true,
    items: list.map((r) => ({
      nome: r.full_name,
      stars: r.stargazers_count,
      link: r.html_url,
      link_ok: isAllowedSource(r.html_url),
      descricao: (r.description || '').slice(0, 200),
    })),
  };
}
