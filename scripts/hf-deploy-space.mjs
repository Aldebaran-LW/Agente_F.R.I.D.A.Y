#!/usr/bin/env node
/**
 * Deploy hf-space/demo ou friday-prod para Hugging Face (git push)
 * Uso: node scripts/hf-deploy-space.mjs demo [--repo Aldebaran-LW/OpenClaw] [--secrets]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const p = resolve(root, '.env');
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

const space = process.argv[2];
const repoArg = process.argv.find((a) => a.startsWith('--repo='))?.slice(7)
  || (process.argv.includes('--repo') ? process.argv[process.argv.indexOf('--repo') + 1] : null);
const configureSecrets = process.argv.includes('--secrets');

if (!['demo', 'friday-prod'].includes(space)) {
  console.error('Uso: node scripts/hf-deploy-space.mjs demo|friday-prod [--repo Org/Name] [--secrets]');
  process.exit(1);
}

const token = process.env.HF_TOKEN?.trim();
if (!token) {
  console.error('HF_TOKEN em falta no .env');
  process.exit(1);
}

const repo = repoArg
  || (space === 'demo'
    ? (process.env.HF_SPACE_REPO || 'Aldebaran-LW/openclaw-demo')
    : (process.env.HF_FRIDAY_SPACE_REPO || 'Aldebaran-LW/friday-prod'));
const hfUser = process.env.HF_USERNAME?.trim() || repo.split('/')[0];
const src = resolve(root, 'hf-space', space);
const work = join(tmpdir(), `hf-deploy-${space}`);

if (!existsSync(src)) {
  console.error('Pasta em falta:', src);
  process.exit(1);
}

if (space === 'friday-prod') {
  execSync('node scripts/generate-hf-agents-config.mjs', { cwd: root, stdio: 'inherit' });
}

if (existsSync(work)) rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const cloneUrl = `https://${hfUser}:${token}@huggingface.co/spaces/${repo}`;
console.log('==> Clone', repo);
execSync(`git clone "${cloneUrl}" "${work}"`, { stdio: 'inherit' });

console.log('==> Copiar', src);
for (const name of readdirSync(src)) {
  if (name === '.git' || name === 'desktop.ini' || name === '__pycache__') continue;
  cpSync(join(src, name), join(work, name), { recursive: true, force: true });
}

process.chdir(work);
execSync('git config user.email "openclaw@aldebaran-lw.local"', { stdio: 'pipe' });
execSync('git config user.name "OpenClaw Deploy"', { stdio: 'pipe' });
execSync('git add -A', { stdio: 'inherit' });
const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (!status) {
  console.log('[OK] Nada para commitar');
} else {
  const msg = `Deploy OpenClaw ${space} ${new Date().toISOString().slice(0, 16)}`;
  execSync(`git commit -m "${msg}"`, { stdio: 'inherit' });
  execSync('git push', { stdio: 'inherit' });
  console.log('[OK] Push concluido');
}

if (configureSecrets) {
  process.chdir(root);
  if (space === 'demo') {
    process.env.HF_SPACE_REPO = repo;
    execSync('node scripts/hf-configure-space.mjs', { stdio: 'inherit' });
  } else {
    process.env.HF_FRIDAY_SPACE_REPO = repo;
    execSync('node scripts/hf-configure-friday-prod.mjs', { stdio: 'inherit' });
  }
}

const slug = repo.replace('/', '-').toLowerCase();
console.log('\nSpace: https://huggingface.co/spaces/' + repo);
console.log('App:   https://' + slug + '.hf.space/health');
