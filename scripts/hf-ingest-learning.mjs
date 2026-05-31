#!/usr/bin/env node
/**
 * Regista aprendizagem de um agente no Dataset HF (openclaw-backup).
 * Uso: node scripts/hf-ingest-learning.mjs --agent macofel --text "descobri X no HF"
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { commitDatasetFile } from './lib/hf-dataset-commit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const p = resolve(__dirname, '..', '.env');
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

const agent = process.argv.find((a) => a.startsWith('--agent='))?.slice(8)
  || process.argv[process.argv.indexOf('--agent') + 1];
const text = process.argv.find((a) => a.startsWith('--text='))?.slice(7)
  || process.argv.slice(process.argv.indexOf('--text') + 1).join(' ');

const hfToken = process.env.HF_TOKEN?.trim();
const dataset = process.env.HF_BACKUP_DATASET || 'Aldebaran-LW/openclaw-backup';

if (!hfToken || !agent || !text) {
  console.error('Uso: node scripts/hf-ingest-learning.mjs --agent ID --text "nota"');
  process.exit(1);
}

const entry = {
  at: new Date().toISOString(),
  agent,
  source: 'hf-learning',
  text: text.slice(0, 4000),
};

const day = entry.at.slice(0, 10);
const safeTs = entry.at.replace(/:/g, '-').replace(/\./g, '-');
const filePath = `learnings/${agent}/${day}/${safeTs}.jsonl`;
const content = JSON.stringify(entry) + '\n';

const { ok, status, body } = await commitDatasetFile(
  dataset,
  hfToken,
  filePath,
  content,
  `learning ${agent} ${entry.at}`,
);

if (!ok) {
  console.error('Falhou:', status, body);
  process.exit(1);
}
console.log('[OK] ' + dataset + '/' + filePath);
