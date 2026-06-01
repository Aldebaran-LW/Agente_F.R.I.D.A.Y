#!/usr/bin/env node
/**
 * Rimuru — gera alertas de quota (não bloqueia agentes).
 * Uso:
 *   node scripts/rimuru-alert.mjs --dry-run
 *   node scripts/rimuru-alert.mjs --send
 *   node scripts/rimuru-alert.mjs --provider deepseek --status 402
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchOpenRouterKeyInfo } from './lib/rimuru-token-core.mjs';
import {
  checkAllProviders,
  providerAdvisories,
} from './lib/rimuru-providers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

function buildManualAlert(provider, status) {
  const st = Number(status);
  if (provider === 'deepseek' && st === 402) {
    return 'Rimuru: DeepSeek sem saldo (402). Usar OpenRouter :free ou Ollama na EC2.';
  }
  if (provider === 'groq' && (st === 401 || st === 429)) {
    return `Rimuru: Groq respondeu ${st} — rever GROQ_API_KEY ou rate limit.`;
  }
  return `Rimuru: alerta manual ${provider} status ${status}`;
}

async function persistAlert(content, metadata = {}) {
  try {
    const { isHubEnabled, persistLearning } = await import('../gateway/lib/hub-store.mjs');
    if (!isHubEnabled()) return null;
    return await persistLearning({
      agentId: 'rimuru',
      source: 'rimuru-alert',
      content,
      metadata: { type: 'token_alert', ...metadata },
    });
  } catch (e) {
    console.warn('Hub:', e.message);
    return null;
  }
}

async function sendWebhook(text) {
  const url = process.env.JARVIS_EC2_WEBHOOK_URL?.trim();
  if (!url) return { ok: false, hint: 'JARVIS_EC2_WEBHOOK_URL ausente' };
  const token = process.env.OPENCLAW_INTERNAL_TOKEN?.trim()
    || process.env.OPENCLAW_AUTOMATION_TOKEN?.trim();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ source: 'rimuru-alert', message: text }),
    signal: AbortSignal.timeout(15000),
  });
  return { ok: res.ok, status: res.status };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--send');
  const provider = arg('--provider');
  const status = arg('--status');

  let lines = [];
  if (provider && status) {
    lines.push(buildManualAlert(provider, status));
  } else {
    const providers = await checkAllProviders(fetchOpenRouterKeyInfo);
    const advisories = providerAdvisories(providers);
    if (!advisories.length) {
      lines.push('Rimuru: quotas OK — sem alertas.');
    } else {
      lines = advisories
        .filter((a) => a.severity === 'alta' || a.severity === 'media')
        .map((a) => `Rimuru: ${a.mensagem}`);
    }
  }

  const text = lines.join('\n');
  console.log(text);

  if (dryRun) {
    console.log('\n(dry-run — use --send para Hub/webhook)');
    process.exit(0);
  }

  await persistAlert(text, { provider, status });
  const wh = await sendWebhook(text);
  if (wh.ok) console.log('Webhook EC2: enviado.');
  else if (wh.hint) console.log('Webhook:', wh.hint);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
