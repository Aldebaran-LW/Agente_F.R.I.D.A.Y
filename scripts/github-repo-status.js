#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPOS = ['Macofel_2.0', 'VP-Pecas', 'vp-precision-studio', 'LWDigitalForge_Texte'];

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
const owner = process.env.GITHUB_OWNER || 'Aldebaran-LW';
const token = process.env.GITHUB_TOKEN;

async function gh(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'agente-openclaw' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const out = { ok: true, owner, repos: [], at: new Date().toISOString() };
for (const name of REPOS) {
  const repo = await gh(`/repos/${owner}/${name}`);
  out.repos.push({
    name,
    pushed_at: repo.pushed_at,
    open_issues: repo.open_issues_count,
    homepage: repo.homepage,
  });
}
console.log(JSON.stringify(out, null, 2));
