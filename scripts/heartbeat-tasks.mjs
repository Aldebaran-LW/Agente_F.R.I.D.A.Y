#!/usr/bin/env node
/**
 * Tarefas autónomas read-only — chamadas pelo heartbeat.py (sem LLM).
 * Uso: node scripts/heartbeat-tasks.mjs [--json]
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function envBool(name, def = false) {
  const v = process.env[name];
  if (v == null || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function loadEnv() {
  const p = resolve(root, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [k, ...rest] = t.split('=');
    const key = k.trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

async function checkRimuruQuota() {
  const { createTokenManager, loadMonitorSnapshot, loadTokenPolicy } = await import(
    './lib/rimuru-token-core.mjs'
  );
  const policy = loadTokenPolicy();
  const snapshot = loadMonitorSnapshot();
  const manager = createTokenManager({
    usedTokens: Number(snapshot?.estimated_tokens_today) || 0,
  });
  const st = manager.status();
  const alerts = [];
  if (st.level === 'block') {
    alerts.push(`Rimuru: cota local ${st.usagePct}% — LLM bloqueado no gateway.`);
  } else if (st.level === 'warn') {
    alerts.push(`Rimuru: uso local ${st.usagePct}% — preferir scripts e modelos :free.`);
  }
  return { name: 'rimuru_quota', ok: st.level !== 'block', detail: `${st.usagePct}%`, alerts, status: st };
}

async function checkDeployRemote() {
  const base =
    process.env.OPENCLAW_GATEWAY_BASE_URL?.trim()
    || process.env.OPENCLAW_GATEWAY_URL?.trim()
    || 'https://agente-openclaw.vercel.app';
  const url = `${base.replace(/\/$/, '')}/api/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const ok = res.ok;
    return {
      name: 'gateway_prod',
      ok,
      detail: ok ? `HTTP ${res.status} ${url}` : `HTTP ${res.status}`,
      alerts: ok ? [] : [`Gateway produção falhou: ${url}`],
    };
  } catch (e) {
    return {
      name: 'gateway_prod',
      ok: false,
      detail: String(e.message || e),
      alerts: [`Gateway produção inacessível: ${url}`],
    };
  }
}

async function checkGithubWeekly() {
  const dow = new Date().getUTCDay();
  if (dow !== 1 && !envBool('HEARTBEAT_GITHUB_FORCE')) {
    return { name: 'github_weekly', ok: true, detail: 'ignorado (não é segunda)', alerts: [] };
  }
  const { spawnSync } = await import('child_process');
  try {
    const proc = spawnSync('node', [resolve(__dirname, 'github-repo-status.js')], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30000,
    });
    const out = (proc.stdout || '').trim();
    const last = out.split('\n').filter(Boolean).pop() || '';
    let payload = { ok: proc.status === 0 };
    try {
      payload = JSON.parse(last);
    } catch {
      /* stdout não-JSON */
    }
    const alerts =
      payload.ok === false ? ['GitHub weekly: falha ao ler repos Aldebaran-LW.'] : [];
    return {
      name: 'github_weekly',
      ok: payload.ok !== false,
      detail: payload.repos ? `${payload.repos.length} repos` : (proc.status === 0 ? 'ok' : 'falha'),
      alerts,
    };
  } catch (e) {
    return {
      name: 'github_weekly',
      ok: false,
      detail: String(e.message || e),
      alerts: ['GitHub weekly: erro ao executar github-repo-status.js'],
    };
  }
}

async function main() {
  loadEnv();
  const jsonOut = process.argv.includes('--json');
  const tasks = [];

  if (envBool('HEARTBEAT_TASK_RIMURU', true)) tasks.push(checkRimuruQuota);
  if (envBool('HEARTBEAT_TASK_GATEWAY_PROD', true)) tasks.push(checkDeployRemote);
  if (envBool('HEARTBEAT_TASK_GITHUB_WEEKLY', true)) tasks.push(checkGithubWeekly);

  const results = [];
  const alerts = [];
  for (const fn of tasks) {
    const r = await fn();
    results.push(r);
    alerts.push(...(r.alerts || []));
  }

  const payload = {
    ok: results.every((r) => r.ok),
    at: new Date().toISOString(),
    tasks: results,
    alerts,
  };

  if (jsonOut) {
    console.log(JSON.stringify(payload));
  } else {
    for (const r of results) {
      console.log(`${r.name}: ${r.ok ? 'OK' : 'FALHA'} — ${r.detail}`);
    }
    for (const a of alerts) console.log(`ALERTA: ${a}`);
  }
  process.exit(payload.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
