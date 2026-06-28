/**
 * Segundo cérebro OpenClaw — leitura/escrita no vault Obsidian (Celebro LW).
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_ROOT = resolve(__dirname, '..', '..');

const DEFAULT_VAULTS = [
  'H:\\Meu Drive\\Projetos\\Celebro LW',
  'G:\\Meu Drive\\Projetos\\Celebro LW',
];

export function loadEnv(file = resolve(WORKSPACE_ROOT, '.env')) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}

export function resolveVaultPath() {
  loadEnv();
  const fromEnv = process.env.OPENCLAW_BRAIN_VAULT?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  for (const p of DEFAULT_VAULTS) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    'Vault não encontrado. Defina OPENCLAW_BRAIN_VAULT no .env (ex.: H:\\Meu Drive\\Projetos\\Celebro LW)'
  );
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

export function extractSection(md, heading) {
  if (!md) return '';
  const re = new RegExp(`^## ${heading}\\s*$([\\s\\S]*?)(?=^## |\\Z)`, 'm');
  const m = md.match(re);
  return m ? m[1].trim() : '';
}

export function listProjectNotes(vault) {
  const dir = join(vault, 'projects');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const path = join(dir, f);
      const body = readText(path) || '';
      const status =
        body.match(/^status:\s*(\S+)/m)?.[1] ||
        body.match(/status:\s*(\S+)/)?.[1] ||
        'unknown';
      return { name: f.replace(/\.md$/, ''), path, status };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function ensureDailyNote(vault, date = todayIso()) {
  const dailyDir = join(vault, 'daily');
  if (!existsSync(dailyDir)) mkdirSync(dailyDir, { recursive: true });
  const path = join(dailyDir, `${date}.md`);
  if (!existsSync(path)) {
    const tpl = `# ${date}

---
date: ${date}
tags:
  - daily
---

## Hoje (30s)

- Rodar: \`node scripts/brain.mjs standup\`
- Foco: [[projects/OpenClaw]]

## Projetos ativos

- [[projects/OpenClaw]]

## Dump

`;
    writeFileSync(path, tpl, 'utf8');
  }
  return path;
}

export function appendToDaily(vault, text, date = todayIso()) {
  const path = ensureDailyNote(vault, date);
  const stamp = new Date().toTimeString().slice(0, 5);
  const block = `\n### ${stamp}\n\n${text.trim()}\n`;
  let body = readText(path) || '';
  if (!body.includes('## Dump')) {
    body += '\n## Dump\n';
  }
  writeFileSync(path, body.trimEnd() + block + '\n', 'utf8');
  return path;
}

export function vaultPaths(vault) {
  return {
    vault,
    northStar: join(vault, 'brain', 'North Star.md'),
    dailyToday: join(vault, 'daily', `${todayIso()}.md`),
    dailyYesterday: join(vault, 'daily', `${yesterdayIso()}.md`),
    projectsDir: join(vault, 'projects'),
    peopleDir: join(vault, 'people'),
  };
}

export function fileAgeDays(path) {
  if (!existsSync(path)) return null;
  const mtime = statSync(path).mtimeMs;
  return Math.floor((Date.now() - mtime) / 86400000);
}
