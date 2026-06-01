#!/usr/bin/env node
/** @deprecated Use sophia-research.mjs + yato-market-search.mjs */
console.warn('[aviso] yato-research → sophia-research + yato-market-search');
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const scripts = resolve(dirname(fileURLToPath(import.meta.url)));
const topic =
  process.argv[process.argv.indexOf('--topic') + 1] ||
  process.argv[process.argv.indexOf('--query') + 1] ||
  'openclaw';

function run(name, extra = []) {
  return new Promise((res, rej) => {
    const c = spawn(process.execPath, [resolve(scripts, name), '--topic', topic, ...extra], {
      stdio: 'inherit',
      cwd: resolve(scripts, '..'),
    });
    c.on('close', (code) => (code === 0 ? res() : rej(new Error(name))));
  });
}

await run('sophia-research.mjs', process.argv.includes('--yaml') ? ['--yaml'] : []);
await run('yato-market-search.mjs', process.argv.includes('--yaml') ? ['--yaml'] : []);
