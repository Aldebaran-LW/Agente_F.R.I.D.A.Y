import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPACE = process.env.HF_FRIDAY_SPACE_REPO || 'Aldebaran-LW/friday-prod';

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
if (!token) {
  console.error('HF_TOKEN em falta no .env');
  process.exit(1);
}

const secrets = [
  ['OPENROUTER_API_KEY', process.env.OPENROUTER_API_KEY?.trim()],
  ['KILO_API_KEY', process.env.KILO_API_KEY?.trim()],
  ['HF_TOKEN', token],
  ['OPENCLAW_GATEWAY_BASE_URL', process.env.OPENCLAW_GATEWAY_BASE_URL?.trim()],
  ['OPENCLAW_AUTOMATION_TOKEN', process.env.OPENCLAW_AUTOMATION_TOKEN?.trim()],
];

const variables = [
  ['HF_BACKUP_DATASET', process.env.HF_BACKUP_DATASET || 'Aldebaran-LW/openclaw-backup'],
  ['HF_CORPUS_DATASET', process.env.HF_CORPUS_DATASET?.trim() || process.env.HF_BACKUP_DATASET || 'Aldebaran-LW/openclaw-backup'],
  ['HF_LEARNING_AUTO', process.env.HF_LEARNING_AUTO?.trim() || 'true'],
  ['KILO_GATEWAY_BASE_URL', process.env.KILO_GATEWAY_BASE_URL?.trim() || 'https://api.kilo.ai/api/gateway'],
  ['OLLAMA_API_URL', process.env.OLLAMA_API_URL?.trim()],
  ['OLLAMA_MODEL', process.env.OLLAMA_MODEL?.trim() || 'smollm2:360m'],
  ['FRIDAY_DISABLE_OPENROUTER', process.env.FRIDAY_DISABLE_OPENROUTER?.trim()],
];

console.log('Space', SPACE);

for (const [key, value] of secrets) {
  if (!value) {
    console.log('  [SKIP] secret', key);
    continue;
  }
  const res = await fetch(`https://huggingface.co/api/spaces/${SPACE}/secrets`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
    signal: AbortSignal.timeout(20000),
  });
  console.log('  [' + (res.ok ? 'OK' : 'FALHA') + '] secret', key, 'HTTP', res.status);
}

for (const [key, value] of variables) {
  if (value === undefined || value === '') {
    console.log('  [SKIP] variable', key);
    continue;
  }
  const res = await fetch(`https://huggingface.co/api/spaces/${SPACE}/variables`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
    signal: AbortSignal.timeout(20000),
  });
  console.log('  [' + (res.ok ? 'OK' : 'FALHA') + '] variable', key, 'HTTP', res.status);
}

const rt = await fetch(`https://huggingface.co/api/spaces/${SPACE}/runtime`, {
  headers: { Authorization: 'Bearer ' + token },
  signal: AbortSignal.timeout(20000),
}).then((r) => r.json());
console.log('Runtime stage:', rt.stage || rt.error || '?');
