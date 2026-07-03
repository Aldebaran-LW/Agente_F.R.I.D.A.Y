#!/usr/bin/env node
/**
 * Verifica drift corpus vs allowlist (sem LLM).
 * Uso: node scripts/corpus-staleness.mjs [--json]
 */
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { checkCorpusStaleness } from './lib/corpus-staleness-core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsonOut = process.argv.includes('--json');
const result = checkCorpusStaleness(root);

if (jsonOut) {
  console.log(JSON.stringify(result));
} else {
  console.log(result.summary);
  if (result.built_at) console.log(`Índice: ${result.built_at} (${result.entry_count} entries)`);
  for (const s of result.stale) {
    console.log(`  • ${s.path} — ${s.reason}${s.mtime ? ` (${s.mtime})` : ''}`);
  }
}

process.exit(result.ok ? 0 : 1);
