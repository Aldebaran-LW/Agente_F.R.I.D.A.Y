import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPACE = process.env.HF_SPACE_REPO || 'Aldebaran-LW/openclaw-demo';

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
const token = process.env.HF_TOKEN?.trim();
if (!token) { console.error('HF_TOKEN em falta no .env'); process.exit(1); }

for (const [key, value] of [
  ['OPENCLAW_GATEWAY_BASE_URL', process.env.OPENCLAW_GATEWAY_BASE_URL?.trim()],
  ['OPENCLAW_AUTOMATION_TOKEN', process.env.OPENCLAW_AUTOMATION_TOKEN?.trim()],
]) {
  if (!value) { console.log('  [SKIP] ' + key); continue; }
  const res = await fetch('https://huggingface.co/api/spaces/' + SPACE + '/secrets', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
    signal: AbortSignal.timeout(20000),
  });
  console.log('  [' + (res.ok ? 'OK' : 'FALHA') + '] secret ' + key + ' HTTP ' + res.status);
}

const rt = await fetch('https://huggingface.co/api/spaces/' + SPACE + '/runtime', {
  headers: { Authorization: 'Bearer ' + token },
  signal: AbortSignal.timeout(20000),
}).then((r) => r.json());
console.log('Space ' + SPACE + ': stage=' + rt.stage);