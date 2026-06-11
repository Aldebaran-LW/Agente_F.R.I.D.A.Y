#!/usr/bin/env node
/**
 * Deploy HF Spaces OpenClaw
 * Uso: node scripts/hf-deploy-space.mjs --profile core|innovation|macofel|unified|demo [--secrets]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { HF_SPACE_PROFILES } from './lib/hf-space-profiles.mjs';

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

const profileId = process.argv.find((a) => a.startsWith('--profile='))?.slice(10)
  || (process.argv.includes('--profile') ? process.argv[process.argv.indexOf('--profile') + 1] : null)
  || (process.argv[2] === 'demo' ? 'demo' : null)
  || (process.argv[2] === 'friday-prod' ? 'unified' : process.argv[2]);

const repoArg = process.argv.find((a) => a.startsWith('--repo='))?.slice(7)
  || (process.argv.includes('--repo') ? process.argv[process.argv.indexOf('--repo') + 1] : null);
const configureSecrets = process.argv.includes('--secrets') || process.argv.includes('--configure-secrets');

const validProfiles = [...Object.keys(HF_SPACE_PROFILES), 'demo'];
if (!profileId || !validProfiles.includes(profileId)) {
  console.error('Uso: node scripts/hf-deploy-space.mjs --profile core|innovation|macofel|unified|demo [--secrets]');
  process.exit(1);
}

const token = process.env.HF_TOKEN?.trim();
if (!token) {
  console.error('HF_TOKEN em falta no .env');
  process.exit(1);
}

const profile = HF_SPACE_PROFILES[profileId];
const repo = repoArg
  || (profileId === 'demo'
    ? (process.env.HF_SPACE_REPO || 'Aldebaran-LW/openclaw-demo')
    : (profile?.repo || process.env.HF_FRIDAY_SPACE_REPO || 'Aldebaran-LW/friday-prod'));

const folderName = profileId === 'unified' ? 'friday-prod' : profileId === 'demo' ? 'demo' : profileId;
const src = resolve(root, 'hf-space', folderName);

if (profileId !== 'demo' && profileId !== 'unified') {
  execSync(`node scripts/hf-assemble-space.mjs --profile ${profileId}`, { cwd: root, stdio: 'inherit' });
} else if (profileId === 'unified') {
  execSync('node scripts/generate-hf-agents-config.mjs --profile unified', { cwd: root, stdio: 'inherit' });
}

if (!existsSync(src)) {
  console.error('Pasta em falta:', src);
  process.exit(1);
}

const hfUser = process.env.HF_USERNAME?.trim() || repo.split('/')[0];
const work = join(tmpdir(), `hf-deploy-${folderName}`);
if (existsSync(work)) rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const cloneUrl = `https://${hfUser}:${token}@huggingface.co/spaces/${repo}`;
console.log('==> Clone', repo);
execSync(`git clone "${cloneUrl}" "${work}"`, { stdio: 'inherit' });

console.log('==> Copiar', src);
for (const name of readdirSync(src)) {
  if (['.git', 'desktop.ini', '__pycache__'].includes(name)) continue;
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
  const msg = `Deploy OpenClaw ${profileId} ${new Date().toISOString().slice(0, 16)}`;
  execSync(`git commit -m "${msg}"`, { stdio: 'inherit' });
  execSync('git push', { stdio: 'inherit' });
  console.log('[OK] Push concluido');
}

if (configureSecrets && profileId !== 'demo') {
  process.chdir(root);
  process.env.HF_FRIDAY_SPACE_REPO = repo;
  execSync('node scripts/hf-configure-friday-prod.mjs', { stdio: 'inherit' });
} else if (configureSecrets && profileId === 'demo') {
  process.chdir(root);
  process.env.HF_SPACE_REPO = repo;
  execSync('node scripts/hf-configure-space.mjs', { stdio: 'inherit' });
}

const slug = repo.replace('/', '-').toLowerCase();
console.log('\nSpace: https://huggingface.co/spaces/' + repo);
console.log('App:   https://' + slug + '.hf.space/health');
