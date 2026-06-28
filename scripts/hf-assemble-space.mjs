#!/usr/bin/env node
/**
 * Monta hf-space/<profile>/ a partir do template friday-prod.
 * Uso: node scripts/hf-assemble-space.mjs --profile core
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { HF_SPACE_PROFILES } from './lib/hf-space-profiles.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const profileId = process.argv.find((a) => a.startsWith('--profile='))?.slice(10)
  || process.argv[process.argv.indexOf('--profile') + 1];

if (!profileId || !HF_SPACE_PROFILES[profileId]) {
  console.error('Uso: node scripts/hf-assemble-space.mjs --profile core|innovation|macofel');
  process.exit(1);
}

const profile = HF_SPACE_PROFILES[profileId];
const template = resolve(root, 'hf-space', 'friday-prod');
const dest = resolve(root, 'hf-space', profileId === 'unified' ? 'friday-prod' : profileId);

if (!existsSync(template)) {
  console.error('Template em falta:', template);
  process.exit(1);
}

const SKIP = new Set(['.git', '__pycache__', 'desktop.ini', 'agents-config.yaml']);

function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(name.name)) continue;
    const s = join(src, name.name);
    const d = join(dst, name.name);
    if (name.isDirectory()) copyDir(s, d);
    else cpSync(s, d);
  }
}

if (profileId !== 'unified' && existsSync(dest)) {
  try {
    rmSync(dest, { recursive: true, force: true });
  } catch (e) {
    if (e?.code === 'EBUSY') {
      console.warn('[AVISO] pasta bloqueada (Drive/Docker) — sobrescrever ficheiros in-place:', dest);
    } else {
      throw e;
    }
  }
}
if (profileId !== 'unified') {
  copyDir(template, dest);
}

const gen = spawnSync(
  process.execPath,
  [
    resolve(root, 'scripts/generate-hf-agents-config.mjs'),
    `--profile=${profileId}`,
    `--out=${join(dest, 'agents-config.yaml')}`,
  ],
  { cwd: root, encoding: 'utf8', stdio: 'inherit' },
);
if (gen.status !== 0) process.exit(gen.status || 1);

const dockerPath = join(dest, 'Dockerfile');
let docker = readFileSync(dockerPath, 'utf8');
if (!docker.includes('SPACE_PROFILE=')) {
  docker = docker.replace(
    'ENV KEEPALIVE_MS=240000',
    `ENV SPACE_PROFILE=${profile.spaceProfile}\nENV KEEPALIVE_MS=240000`,
  );
} else {
  docker = docker.replace(/ENV SPACE_PROFILE=.*/, `ENV SPACE_PROFILE=${profile.spaceProfile}`);
}
writeFileSync(dockerPath, docker);

const readmePath = join(dest, 'README.md');
writeFileSync(
  readmePath,
  `---
title: ${profile.title}
emoji: ${profile.emoji}
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

${profile.title} — Space OpenClaw (\`${profile.spaceProfile}\`).

Repo HF: \`${profile.repo}\`

Assemblar: \`node scripts/hf-assemble-space.mjs --profile ${profileId}\`
Deploy: \`node scripts/hf-deploy-space.mjs --profile ${profileId} --configure-secrets\`
`,
  'utf8',
);

console.log('[OK] Space montado:', dest);
console.log('     profile:', profile.spaceProfile, '| agentes:', profile.agents);
