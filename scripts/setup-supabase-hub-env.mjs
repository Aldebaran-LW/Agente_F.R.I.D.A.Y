#!/usr/bin/env node
/**
 * Grava SUPABASE_URL + service_role em gateway/.env (local, gitignored).
 * Uso: node scripts/setup-supabase-hub-env.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokensPath = resolve(root, 'Chaves', 'Tokens.txt');
const gatewayEnv = resolve(root, 'gateway', '.env');
const PROJECT_REF = 'wwwwyuwighdehmvnolrl';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

function loadAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  if (!existsSync(tokensPath)) throw new Error('Chaves/Tokens.txt nao encontrado');
  const line = readFileSync(tokensPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('SUPABASE_ACCESS_TOKEN=') && !l.trimStart().startsWith('#'));
  if (!line) throw new Error('SUPABASE_ACCESS_TOKEN ausente em Tokens.txt');
  return line.slice('SUPABASE_ACCESS_TOKEN='.length).trim().replace(/^["']|["']$/g, '');
}

function fetchServiceRole() {
  const token = loadAccessToken();
  const out = execSync(`npx supabase projects api-keys --project-ref ${PROJECT_REF} -o json`, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
  });
  const keys = JSON.parse(out);
  const row = keys.find((k) => k.name === 'service_role' || k.description?.includes('service_role'));
  if (!row?.api_key) throw new Error('service_role key nao encontrada');
  return row.api_key;
}

function upsertEnv(path, vars) {
  let content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    if (re.test(content)) content = content.replace(re, line);
    else content += (content.endsWith('\n') || !content ? '' : '\n') + line + '\n';
  }
  writeFileSync(path, content, 'utf8');
}

const serviceKey = fetchServiceRole();
upsertEnv(gatewayEnv, {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
});

console.log('[OK] gateway/.env atualizado: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
console.log('[INFO] Projeto: LW_Digital_Forge (' + PROJECT_REF + ')');
console.log('[AVISO] Adicione as mesmas vars na Vercel e faca redeploy para /openclaw/hub/health em producao.');
