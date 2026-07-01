#!/usr/bin/env node
/**
 * RAG leve local — busca keyword em docs/agents/skills (allowlist).
 * Sem LLM, sem Qdrant. Uso antes de chamar HF/OpenRouter.
 *
 *   node scripts/corpus-search-local.mjs "rimuru gate"
 *   node scripts/corpus-search-local.mjs "heimdall cron" --agent=heimdall --json
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chunkText, inferAgent, scrubSecrets } from './lib/corpus-chunk.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadAllowlist() {
  const p = resolve(root, 'config/corpus-allowlist.txt');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

function parseArgs(argv) {
  const json = argv.includes('--json');
  const agentArg = argv.find((a) => a.startsWith('--agent='));
  const agent = agentArg ? agentArg.slice(8) : null;
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice(8)) : 5;
  const query = argv.filter((a) => !a.startsWith('--'))[2] || argv[2];
  return { json, agent, limit, query: String(query || '').trim() };
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

export function searchLocalCorpus(query, { agent = null, limit = 5 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) {
    return { ok: false, error: 'query too short (min 2 chars)', hits: [] };
  }

  const tokens = q.split(/\W+/).filter((t) => t.length > 2);
  const paths = loadAllowlist();
  const hits = [];

  for (const rel of paths) {
    const abs = resolve(root, rel);
    if (!existsSync(abs)) continue;
    const fileAgent = inferAgent(rel);
    if (agent && fileAgent !== agent && fileAgent !== 'shared' && fileAgent !== 'orchestrator') {
      continue;
    }
    const raw = scrubSecrets(readFileSync(abs, 'utf8'));
    const chunks = chunkText(raw, 2000);
    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      const score = scoreText(text, tokens, q);
      if (score <= 0) continue;
      hits.push({
        score,
        path: rel,
        agent: fileAgent,
        chunk: i,
        text: text.slice(0, 1200),
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return { ok: true, query, agent, source: 'local-allowlist', hits: hits.slice(limit) };
}

function formatHits(report) {
  if (!report.ok) return `[corpus-local] ${report.error}`;
  if (!report.hits.length) {
    return `[corpus-local] Nenhum resultado para «${report.query}». Ver config/corpus-allowlist.txt`;
  }
  return report.hits
    .map((h) => `— ${h.path}#${h.chunk} (agent=${h.agent}, score=${h.score})\n${h.text.slice(0, 500)}`)
    .join('\n\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { json, agent, limit, query } = parseArgs(process.argv);
  if (!query) {
    console.error('Uso: node scripts/corpus-search-local.mjs "termos" [--agent=heimdall] [--limit=5] [--json]');
    process.exit(1);
  }
  const report = searchLocalCorpus(query, { agent, limit });
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatHits(report));
}
