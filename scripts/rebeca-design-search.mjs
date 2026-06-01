#!/usr/bin/env node
/**
 * Rebeca — busca Spaces HF por palavra-chave (relatório JSON, sem cópia automática).
 * Uso: node scripts/rebeca-design-search.mjs [--query design] [--limit 15] [--json]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { searchHfSpaces } from './lib/hf-spaces-search.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const DEFAULT_QUERIES = ['design', 'ui', '3d', 'animation', 'dashboard'];

function loadEnv() {
  const p = resolve(root, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}

loadEnv();

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  return null;
}

function todayDir() {
  const d = new Date().toISOString().slice(0, 10);
  const dir = join(root, 'data', 'design', d);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

async function main() {
  const json = process.argv.includes('--json');
  const singleQuery = argValue('--query') || argValue('--topic');
  const limit = Number(argValue('--limit')) || 12;
  const queries = singleQuery ? [singleQuery] : DEFAULT_QUERIES;

  const token = process.env.HF_TOKEN?.trim();
  const byQuery = {};
  const all = [];

  for (const q of queries) {
    try {
      const hits = await searchHfSpaces(q, limit);
      const mapped = hits.map((h) => ({
        ...h,
        candidato: h.stage === 'RUNNING',
        copiar: false,
        nota: 'revisão manual — ver hf-space/demo/',
        search_query: q,
      }));
      byQuery[q] = mapped;
      all.push(...mapped);
    } catch (e) {
      byQuery[q] = { error: String(e.message || e) };
    }
  }

  const unique = new Map();
  for (const h of all) {
    if (!unique.has(h.id)) unique.set(h.id, h);
  }
  const candidatos = [...unique.values()].filter((h) => h.candidato && h.link_ok);

  const report = {
    ok: true,
    source: 'rebeca-design-search',
    gerado_em: new Date().toISOString(),
    hf_token: Boolean(token),
    queries,
    total_hits: unique.size,
    candidatos: candidatos.slice(0, 30),
    by_query: byQuery,
    politica: 'Não copiar código automaticamente. Revisar e integrar manualmente.',
    template_local: 'hf-space/demo/',
  };

  const outPath = join(
    todayDir(),
    `rebeca_search_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`
  );
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  report.saved_to = outPath;

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Rebeca [HF search]: ${candidatos.length} candidatos (${unique.size} spaces únicos).`);
    console.log(`Relatório: ${outPath}`);
    for (const c of candidatos.slice(0, 8)) {
      console.log(`• ${c.id} (${c.stage}) — ${c.search_query}`);
    }
    if (!token) {
      console.log('\nDica: HF_TOKEN no .env aumenta rate limit da API Hub.');
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
