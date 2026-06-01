/**
 * Sinais de mercado via GitHub (proxy de adoção) + queries orientadas a negócio.
 * Fontes futuras: Product Hunt, G2, Google Trends (API).
 */
import { searchGithubRepos } from './yato-github-search.mjs';

const MARKET_QUERY_SUFFIX = 'stars:>100';

export async function searchMarketSignals(topic, limit = 10) {
  const q = `${topic} ${MARKET_QUERY_SUFFIX}`.trim();
  const gh = await searchGithubRepos(q, limit);
  const repos = gh.items || [];
  return repos.map((r) => ({
    ...r,
    notas: 'Proxy mercado: adoção GitHub (≥100★). Integrar Product Hunt/G2 quando API disponível.',
    segmento: 'tecnologia_B2B',
  }));
}
