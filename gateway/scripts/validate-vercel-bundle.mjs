#!/usr/bin/env node
/**
 * Falha o build Vercel se existirem .mjs UTF-16 ou sintaxe inválida.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function isUtf16(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return true;
  if (buf.length < 4) return false;
  let zeros = 0;
  let chars = 0;
  for (let i = 1; i < Math.min(buf.length, 40); i += 2) {
    chars++;
    if (buf[i] === 0) zeros++;
  }
  return chars > 3 && zeros / chars > 0.8;
}

const skip = new Set(['node_modules', '.vercel', '.git']);
const errors = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name) || name === 'gateway') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!name.endsWith('.mjs')) continue;
    const buf = readFileSync(p);
    if (isUtf16(buf)) {
      errors.push(`UTF-16: ${p.replace(root + '\\', '').replace(root + '/', '')}`);
      continue;
    }
    const check = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
    if (check.status !== 0) {
      errors.push(`syntax: ${p.replace(root + '\\', '').replace(root + '/', '')}`);
    }
  }
}

walk(root);

if (errors.length) {
  console.error('[validate-vercel-bundle] FALHA:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}

console.log('[validate-vercel-bundle] OK — .mjs UTF-8 válidos');
