#!/usr/bin/env node
/**
 * Sincroniza docs/skills (allowlist) → Dataset HF corpus/
 * Uso: node scripts/hf-ingest-corpus.mjs [--dry-run] [--file path]
 */
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { commitDatasetFile } from './lib/hf-dataset-commit.mjs';
import { buildCorpusRecords } from './lib/corpus-chunk.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

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

const dryRun = process.argv.includes('--dry-run');
const singleFile = process.argv.find((a) => a.startsWith('--file='))?.slice(7)
  || (process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : null);

const hfToken = process.env.HF_TOKEN?.trim();
const dataset = process.env.HF_CORPUS_DATASET?.trim()
  || process.env.HF_BACKUP_DATASET?.trim()
  || 'Aldebaran-LW/openclaw-backup';

if (!hfToken && !dryRun) {
  console.error('HF_TOKEN em falta no .env');
  process.exit(1);
}

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function loadAllowlist() {
  const p = resolve(root, 'config/corpus-allowlist.txt');
  if (!existsSync(p)) throw new Error('config/corpus-allowlist.txt em falta');
  return readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

const sha = gitSha();
const paths = singleFile ? [singleFile] : loadAllowlist();
const manifest = {
  updated_at: new Date().toISOString(),
  git_sha: sha,
  dataset,
  files: [],
  chunk_count: 0,
};

let ok = 0;
let fail = 0;

for (const rel of paths) {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) {
    console.warn('[SKIP] nao existe:', rel);
    continue;
  }
  const content = readFileSync(abs, 'utf8');
  const records = buildCorpusRecords({ relPath: rel, content, gitSha: sha });
  const corpusFolder = inferCorpusFolder(rel);
  const outPath = `corpus/${corpusFolder}/${rel.replace(/\\/g, '/')}.jsonl`;
  const body = records.map((r) => JSON.stringify(r)).join('\n') + '\n';

  manifest.files.push({
    path: rel,
    corpus_path: outPath,
    agent: records[0]?.agent || 'shared',
    chunks: records.length,
  });
  manifest.chunk_count += records.length;

  if (dryRun) {
    console.log(`[dry-run] ${rel} → ${outPath} (${records.length} chunks)`);
    ok++;
    continue;
  }

  const { ok: committed, status, body: resBody } = await commitDatasetFile(
    dataset,
    hfToken,
    outPath,
    body,
    `corpus ${rel}`,
  );
  if (committed) {
    console.log('[OK]', outPath, `(${records.length} chunks)`);
    ok++;
  } else {
    console.error('[FALHA]', rel, status, resBody);
    fail++;
  }
}

function inferCorpusFolder(rel) {
  const p = rel.replace(/\\/g, '/');
  if (p.includes('macofel') || p.startsWith('agents/macofel')) return 'macofel';
  if (/heimdall|CRON|github|deploy|GATEWAY/i.test(p)) return 'ops';
  if (/innovation|sophia|yato|senku|gideon/i.test(p)) return 'innovation';
  if (p.startsWith('agents/')) return 'agents';
  if (p.startsWith('skills/')) return 'skills';
  return 'openclaw-core';
}

const manifestPath = 'corpus/manifest.json';
const manifestJson = JSON.stringify(manifest, null, 2) + '\n';

if (dryRun) {
  console.log('\n[dry-run] manifest:', manifestPath, `(${manifest.chunk_count} chunks total)`);
} else {
  const m = await commitDatasetFile(dataset, hfToken, manifestPath, manifestJson, 'corpus manifest');
  if (!m.ok) {
    console.error('Falha manifest:', m.status, m.body);
    fail++;
  } else {
    console.log('[OK]', manifestPath);
  }
}

console.log(`\nResumo: ${ok} ficheiros, ${manifest.chunk_count} chunks, ${fail} falhas → ${dataset}`);
if (fail) process.exit(1);
