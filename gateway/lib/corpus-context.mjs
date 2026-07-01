/**
 * Contexto corpus para rotas LLM/HF — busca keyword sem LLM.
 * Índice local em data/corpus-index.json (gerado no vercel-build).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gatewayRoot = resolve(__dirname, '..');
const repoRoot = resolve(gatewayRoot, '..');

const AGENT_BY_SKILL = {
  'innovation-knowledge': 'sophia',
  'innovation-market': 'yato',
  'innovation-analysis': 'senku',
  'innovation-forecast': 'gideon',
  'innovation-research': 'sophia',
  'innovation-viability': 'gideon',
  'innovation-build': 'hefestos',
};

let indexCache = null;

function loadIndex() {
  if (indexCache) return indexCache;
  const candidates = [
    resolve(gatewayRoot, 'data', 'corpus-index.json'),
    resolve(repoRoot, 'data', 'corpus-index.json'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      indexCache = JSON.parse(readFileSync(p, 'utf8'));
      return indexCache;
    } catch {
      /* try next */
    }
  }
  indexCache = { entries: [] };
  return indexCache;
}

function scoreText(hay, tokens, fullQ) {
  const lower = hay.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (lower.includes(t)) score += 1;
  }
  if (fullQ && lower.includes(fullQ)) score += tokens.length;
  return score;
}

/**
 * @param {string} query
 * @param {{ agent?: string|null, limit?: number }} [opts]
 */
export function searchCorpusIndex(query, opts = {}) {
  const q = String(query || '').trim().toLowerCase();
  const limit = opts.limit ?? 3;
  const agent = opts.agent?.trim() || null;
  if (q.length < 2) {
    return { ok: false, error: 'query too short', hits: [] };
  }

  const tokens = q.split(/\W+/).filter((t) => t.length > 2);
  const { entries = [] } = loadIndex();
  const hits = [];

  for (const row of entries) {
    if (agent && row.agent && row.agent !== agent && row.agent !== 'shared' && row.agent !== 'orchestrator') {
      continue;
    }
    const text = String(row.text || '');
    const score = scoreText(text, tokens, q);
    if (score <= 0) continue;
    hits.push({
      score,
      path: row.path,
      agent: row.agent,
      text: text.slice(0, 800),
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return { ok: true, query: q, agent, source: 'corpus-index', hits: hits.slice(limit) };
}

export function agentForSkill(skill) {
  return AGENT_BY_SKILL[skill] || null;
}

/**
 * Prefixa task HF com excertos do corpus (determinístico).
 * @param {string} message
 * @param {{ skill?: string, agent?: string, limit?: number }} [opts]
 */
export function buildCorpusContextBlock(message, opts = {}) {
  if (process.env.CORPUS_CONTEXT_DISABLED === '1') {
    return { block: '', hits: [], enriched: false };
  }
  const agent = opts.agent || (opts.skill ? agentForSkill(opts.skill) : null);
  const report = searchCorpusIndex(message, { agent, limit: opts.limit ?? 3 });
  if (!report.ok || !report.hits.length) {
    return { block: '', hits: [], enriched: false };
  }

  const lines = report.hits.map(
    (h) => `— ${h.path} (agent=${h.agent})\n${h.text.slice(0, 400)}`,
  );
  const block = [
    '[OpenClaw corpus — contexto interno para o agente; não citar literalmente ao utilizador]',
    ...lines,
    '---',
  ].join('\n');

  return { block, hits: report.hits, enriched: true, source: report.source };
}

export function enrichTaskWithCorpus(task, opts = {}) {
  const { block } = buildCorpusContextBlock(task, opts);
  if (!block) return { task: String(task), enriched: false };
  const base = String(task).slice(0, 6000);
  const maxBlock = 1800;
  const trimmedBlock =
    block.length > maxBlock ? `${block.slice(0, maxBlock)}\n…` : block;
  // Pedido do utilizador primeiro — corpus é suporte, não pode empurrar o texto fora
  const combined = `${base}\n\n${trimmedBlock}`;
  return {
    task: combined.slice(0, 8000),
    enriched: true,
  };
}
