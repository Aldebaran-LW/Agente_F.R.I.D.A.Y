/**
 * Busca Spaces HF (partilhado Yato / Rebeca).
 */
import { isAllowedSource } from '../../agents/veldora/validate-sources.mjs';

/**
 * @param {string} query
 * @param {number} limit
 */
export async function searchHfSpaces(query, limit = 15) {
  const token = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_HUB_TOKEN?.trim();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `https://huggingface.co/api/spaces?search=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
  const body = await res.json().catch(() => []);
  const list = Array.isArray(body) ? body : body.spaces || [];

  return list.map((s) => {
    const id = s.id || `${s.author || s.owner}/${s.name}`;
    const link = `https://huggingface.co/spaces/${id}`;
    const runtime = s.runtime || {};
    const stage = runtime.stage || s.stage || 'unknown';
    return {
      id,
      sdk: s.sdk,
      likes: s.likes ?? 0,
      stage,
      link,
      link_ok: isAllowedSource(link),
      descricao: (s.cardData?.short_description || s.description || '').slice(0, 200),
    };
  });
}
