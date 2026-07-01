#!/usr/bin/env node
/**
 * Gera data/corpus-index.json a partir de config/corpus-allowlist.txt
 * Uso: node scripts/build-corpus-index.mjs
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildCorpusRecords } from './lib/corpus-chunk.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadAllowlist() {
  const p = resolve(root, 'config/corpus-allowlist.txt');
  return readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

const entries = [];
for (const rel of loadAllowlist()) {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) continue;
  const content = readFileSync(abs, 'utf8');
  const records = buildCorpusRecords({ relPath: rel, content });
  for (const r of records) {
    entries.push({
      path: r.path,
      agent: r.agent,
      text: r.text,
      tags: r.tags,
      id: r.id,
    });
  }
}

const payload = {
  built_at: new Date().toISOString(),
  entry_count: entries.length,
  entries,
};

for (const outDir of [resolve(root, 'data'), resolve(root, 'gateway', 'data')]) {
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, 'corpus-index.json');
  writeFileSync(out, `${JSON.stringify(payload)}\n`, 'utf8');
  console.log(`[corpus-index] ${entries.length} entries → ${out}`);
}
