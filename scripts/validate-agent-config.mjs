import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const agents = ['orchestrator', 'macofel', 'ops', 'vp-pecas'];

let fails = 0;
console.log('=== Validacao agents/*/config.yaml ===\n');

for (const id of agents) {
  const p = resolve(root, 'agents', id, 'config.yaml');
  if (!existsSync(p)) {
    console.log('  [FALHA] ' + id + ' — ficheiro em falta');
    fails++;
    continue;
  }
  const text = readFileSync(p, 'utf8');
  const okId = new RegExp('^id:\\s*' + id + '\\s*$', 'm').test(text);
  const okModel = /^\s*model:\s*.+/m.test(text);
  const okKey = /env_key:\s*OPENROUTER_API_KEY/.test(text);
  const model = text.match(/^\s*model:\s*(.+)$/m)?.[1] || '?';
  const ok = okId && okModel && okKey;
  if (!ok) fails++;
  console.log('  [' + (ok ? 'OK' : 'FALHA') + '] ' + id + ' — ' + model);
}

console.log(fails ? '\n' + fails + ' falha(s).\n' : '\nConfigs OK.\n');
process.exitCode = fails ? 1 : 0;