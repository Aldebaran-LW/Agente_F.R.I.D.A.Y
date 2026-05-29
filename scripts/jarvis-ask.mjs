/**
 * Pergunta ao Jarvis no gateway Vercel.
 * Uso: node jarvis-ask.mjs "status macofel"
 */
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

async function main() {
  loadEnv();

  const message = process.argv.slice(2).join(' ') || 'ajuda';
  const base = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
  const token = process.env.OPENCLAW_AUTOMATION_TOKEN;

  if (!base || !token) {
    console.log(
      JSON.stringify({
        ok: false,
        error: 'OPENCLAW_GATEWAY_BASE_URL and OPENCLAW_AUTOMATION_TOKEN required',
      })
    );
    process.exitCode = 1;
    return;
  }

  const url = `${base}/jarvis`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const bypass = process.env.VERCEL_PROTECTION_BYPASS?.trim();
  if (bypass) headers['x-vercel-protection-bypass'] = bypass;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
    signal: AbortSignal.timeout(30000),
  });

  const body = await res.json().catch(() => ({}));
  if (body.telegram?.telegram_html && process.argv.includes('--telegram')) {
    console.log('\n--- Telegram HTML ---\n');
    console.log(body.telegram.telegram_html);
    console.log('\n--- JSON ---\n');
  }
  console.log(JSON.stringify({ http: res.status, ...body }, null, 2));
  process.exitCode = res.ok && body.ok ? 0 : 1;
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: String(err.message || err) }));
  process.exitCode = 1;
});
