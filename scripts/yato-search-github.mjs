#!/usr/bin/env node
/** @deprecated Use sophia-search-github.mjs */
import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
console.warn('[aviso] yato-search-github → sophia-search-github');
const r = spawnSync(process.execPath, [resolve(dirname(fileURLToPath(import.meta.url)), 'sophia-search-github.mjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
