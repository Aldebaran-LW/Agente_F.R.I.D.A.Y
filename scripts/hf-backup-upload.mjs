import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { commitDatasetFile } from './lib/hf-dataset-commit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATASET = process.env.HF_BACKUP_DATASET || 'Aldebaran-LW/openclaw-backup';

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
const hfToken = process.env.HF_TOKEN?.trim();
const gatewayBase = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
const gatewayToken = process.env.OPENCLAW_AUTOMATION_TOKEN?.trim();
if (!hfToken) { console.error('HF_TOKEN em falta'); process.exit(1); }

async function fetchGateway(path) {
  if (!gatewayBase) return null;
  const headers = { Accept: 'application/json' };
  if (gatewayToken) headers.Authorization = 'Bearer ' + gatewayToken;
  const res = await fetch(gatewayBase + path, { headers, signal: AbortSignal.timeout(20000) });
  return { status: res.status, ok: res.ok, body: await res.json().catch(() => ({})) };
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const snapshot = {
  at: new Date().toISOString(),
  source: 'openclaw-hf-backup',
  gateway: gatewayBase || null,
  health: await fetchGateway('/api/health'),
  office: gatewayToken ? await fetchGateway('/openclaw/office/status') : null,
};

const filePath = 'snapshots/' + stamp.slice(0, 10) + '/' + stamp + '.json';
const content = JSON.stringify(snapshot, null, 2);
const { ok, status, body } = await commitDatasetFile(DATASET, hfToken, filePath, content, 'backup ' + snapshot.at);
if (!ok) { console.error('Upload falhou:', status, body); process.exit(1); }
console.log('  [OK] ' + DATASET + '/' + filePath);
