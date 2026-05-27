#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
const token = process.env.VERCEL_API_TOKEN;
if (!token) {
  console.log(JSON.stringify({ ok: false, error: 'VERCEL_API_TOKEN missing' }));
  process.exit(1);
}

const team = process.env.VERCEL_TEAM_ID?.trim();
const teamQ = team ? `teamId=${encodeURIComponent(team)}&` : '';

async function api(path) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return body;
}

try {
  const { projects = [] } = await api(`/v9/projects?${teamQ}limit=20`);
  const pick = projects.filter((p) =>
    /macofel|vp-pecas|vp-precision/i.test(p.name || '')
  );
  const list = (pick.length ? pick : projects).slice(0, 5);
  const out = { ok: true, at: new Date().toISOString(), projects: [] };

  for (const p of list) {
    let latest = null;
    try {
      const d = await api(
        `/v6/deployments?${teamQ}projectId=${p.id}&limit=1`
      );
      latest = d.deployments?.[0] ?? null;
    } catch {
      /* skip */
    }
    out.projects.push({
      name: p.name,
      latest: latest
        ? { url: latest.url, state: latest.readyState || latest.state }
        : null,
    });
  }
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e.message || e) }));
  process.exit(1);
}
