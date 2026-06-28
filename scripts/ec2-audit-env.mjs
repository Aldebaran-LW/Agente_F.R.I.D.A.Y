#!/usr/bin/env node
/** Audita .env — só nomes de chaves e SET/EMPTY/ABSENT (sem valores). */
import { readFileSync, existsSync } from 'fs';

const p = process.argv[2] || '/opt/openclaw/.env';
if (!existsSync(p)) {
  console.log(JSON.stringify({ error: 'missing', path: p }));
  process.exit(1);
}

const keys = {};
for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 1) continue;
  const k = t.slice(0, i).trim();
  const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  keys[k] = v.length > 0;
}

const groups = {
  ec2_obrigatorio: [
    'OPENCLAW_GATEWAY_BASE_URL',
    'OPENCLAW_AUTOMATION_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_ADMIN_CHAT_ID',
  ],
  ec2_llm: [
    'OPENROUTER_API_KEY',
    'DEEPSEEK_API_KEY',
    'GROQ_API_KEY',
    'GOOGLE_API_KEY',
    'OPENAI_API_KEY',
    'HF_TOKEN',
    'KILO_API_KEY',
  ],
  ec2_hf_orchestrate: ['HF_FRIDAY_PROD_URL', 'HF_INNOVATION_SPACE_URL', 'HF_BACKUP_DATASET'],
  so_vercel_macofel: [
    'MONGODB_URI',
    'MONGODB_DB_NAME',
    'MACOFEL_API_BASE',
    'MACOFEL_CATALOG_SECRET',
    'MACOFEL_URL',
    'MACOFEL_IMPORT_SECRET',
  ],
  so_vercel_geral: [
    'GITHUB_TOKEN',
    'GITHUB_OWNER',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'VP_PECAS_URL',
    'VP_PRECISION_URL',
    'VERCEL_API_TOKEN',
  ],
  ec2_heartbeat: [
    'HEARTBEAT_CHECK_MONGODB',
    'HEARTBEAT_CHECK_GATEWAY',
    'HEARTBEAT_CHECK_HEIMDALL_FLOW',
    'HEARTBEAT_AGENT_STALE_MIN',
    'HEARTBEAT_CHECK_SUPABASE',
  ],
  ec2_infra: ['AWS_EC2_HOST', 'OPENCLAW_REPO_ROOT', 'JARVIS_EC2_WEBHOOK_URL', 'OLLAMA_API_KEY'],
};

const status = (k) => (keys[k] === true ? 'SET' : keys[k] === false ? 'EMPTY' : 'ABSENT');
const out = { path: p, groups: {}, extras: [], total_keys: Object.keys(keys).length };

for (const [g, list] of Object.entries(groups)) {
  out.groups[g] = Object.fromEntries(list.map((k) => [k, status(k)]));
}
const known = new Set(Object.values(groups).flat());
out.extras = Object.keys(keys)
  .filter((k) => !known.has(k))
  .sort()
  .map((k) => ({ key: k, status: 'SET' }));

console.log(JSON.stringify(out, null, 2));
