/**
 * Detecta drift entre allowlist/corpus e corpus-index.json (sem LLM).
 */
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadAllowlist(root) {
  const p = resolve(root, 'config/corpus-allowlist.txt');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

export function loadCorpusIndex(root) {
  const candidates = [
    resolve(root, 'data', 'corpus-index.json'),
    resolve(root, 'gateway', 'data', 'corpus-index.json'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      return { path: p, data: JSON.parse(readFileSync(p, 'utf8')) };
    } catch {
      continue;
    }
  }
  return { path: null, data: null };
}

/**
 * @param {string} root — raiz do repo OpenClaw
 */
export function checkCorpusStaleness(root) {
  const allowlist = loadAllowlist(root);
  const { path: indexPath, data: index } = loadCorpusIndex(root);

  if (!index) {
    return {
      ok: false,
      built_at: null,
      index_path: indexPath,
      stale: [{ path: '*', reason: 'index_missing' }],
      summary: 'corpus-index.json ausente — correr node scripts/build-corpus-index.mjs',
    };
  }

  const builtAt = Date.parse(index.built_at || '');
  const indexedPaths = new Set((index.entries || []).map((e) => e.path));
  const stale = [];
  const seen = new Set();

  for (const rel of allowlist) {
    seen.add(rel);
    const abs = resolve(root, rel);
    if (!existsSync(abs)) {
      stale.push({ path: rel, reason: 'missing_file' });
      continue;
    }
    if (!indexedPaths.has(rel)) {
      stale.push({ path: rel, reason: 'not_in_index' });
    }
    if (Number.isFinite(builtAt)) {
      const mtime = statSync(abs).mtimeMs;
      if (mtime > builtAt) {
        stale.push({
          path: rel,
          reason: 'modified_since_build',
          mtime: new Date(mtime).toISOString(),
        });
      }
    }
  }

  for (const p of indexedPaths) {
    if (!seen.has(p)) {
      stale.push({ path: p, reason: 'orphan_in_index' });
    }
  }

  const unique = [];
  const keys = new Set();
  for (const item of stale) {
    const k = `${item.path}:${item.reason}`;
    if (keys.has(k)) continue;
    keys.add(k);
    unique.push(item);
  }

  return {
    ok: unique.length === 0,
    built_at: index.built_at,
    entry_count: index.entry_count,
    index_path: indexPath,
    stale: unique,
    summary:
      unique.length === 0
        ? 'corpus alinhado com allowlist'
        : `${unique.length} ficheiro(s) desatualizado(s) — node scripts/build-corpus-index.mjs`,
  };
}
