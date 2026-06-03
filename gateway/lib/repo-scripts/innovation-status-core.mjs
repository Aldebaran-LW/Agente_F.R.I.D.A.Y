/**
 * Resumo local do pipeline inovação (data/innovation/).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function listJsonInDir(dir, max = 20) {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const p = join(dir, f);
      return { path: p, name: f, mtime: statSync(p).mtime };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, max);
  return files.map(({ path, name, mtime }) => {
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      return { file: name, at: mtime.toISOString(), ...summarize(data) };
    } catch {
      return { file: name, at: mtime.toISOString(), ok: false };
    }
  });
}

function summarize(data) {
  if (!data || typeof data !== 'object') return { ok: false };
  const agent = data.agente || data.agent || data.source;
  const topico = data.topico || data.topic;
  const score = data.confianca_score ?? data.viabilidade_score ?? data.result?.confianca_score;
  const rec = data.recomendacao ?? data.result?.recomendacao;
  return {
    ok: data.ok !== false,
    agent,
    topico,
    score,
    recomendacao: rec,
    correlacoes: data.correlacoes?.length ?? data.result?.correlacoes?.length,
  };
}

export function buildInnovationStatus({ days = 7 } = {}) {
  const base = resolve(root, 'data', 'innovation');
  const since = daysAgo(days);
  const dayDirs = existsSync(base)
    ? readdirSync(base).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    : [];

  const recentDirs = dayDirs
    .map((d) => join(base, d))
    .filter((p) => statSync(p).mtime >= since)
    .sort()
    .reverse();

  const allFiles = [];
  for (const dir of recentDirs) {
    allFiles.push(...listJsonInDir(dir, 50));
  }

  const byPrefix = (prefix) => allFiles.filter((f) => f.file.startsWith(prefix));

  const predictions = byPrefix('gideon_').filter((p) => (p.score ?? 0) >= 70);

  return {
    ok: true,
    source: 'local-data-innovation',
    gerado_em: new Date().toISOString(),
    days,
    knowledge: byPrefix('sophia_').slice(0, 10),
    market: byPrefix('yato_market').slice(0, 10),
    analysis: byPrefix('senku_').slice(0, 5),
    predictions: predictions.slice(0, 5),
    proposals: listJsonInDir(resolve(base, 'proposals'), 5),
    ultimo_pipeline: allFiles[0] || null,
  };
}
