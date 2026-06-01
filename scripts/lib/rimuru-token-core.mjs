/**
 * Rimuru — administração de tokens e monitorização (sem LLM).
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');

let policyCache = null;

export function loadTokenPolicy() {
  if (policyCache) return policyCache;
  const p = resolve(root, 'agents', 'rimuru', 'token-policy.json');
  policyCache = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  return policyCache;
}

export function createTokenManager(opts = {}) {
  const policy = loadTokenPolicy();
  const limit =
    Number(opts.dailyLimit)
    || Number(process.env.RIMURU_DAILY_TOKEN_BUDGET)
    || Number(policy.daily_token_budget)
    || 500_000;

  let used = Number(opts.usedTokens) || 0;

  return {
    limit,
    get used() {
      return used;
    },
    remaining() {
      return Math.max(0, limit - used);
    },
    usagePct() {
      return limit > 0 ? Math.round((used / limit) * 100) : 0;
    },
    canUse(amount) {
      return used + amount <= limit;
    },
    record(amount) {
      if (amount <= 0) return true;
      if (!this.canUse(amount)) return false;
      used += amount;
      return true;
    },
    reset() {
      used = 0;
    },
    status() {
      const pct = this.usagePct();
      const policy = loadTokenPolicy();
      let level = 'ok';
      if (pct >= (policy.block_usage_pct || 95)) level = 'block';
      else if (pct >= (policy.warn_usage_pct || 80)) level = 'warn';
      return { limit, used, remaining: this.remaining(), usagePct: pct, level };
    },
  };
}

export async function fetchOpenRouterKeyInfo() {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    return { ok: false, configured: false, error: 'OPENROUTER_API_KEY ausente' };
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'HTTP-Referer': 'https://openclaw.lwdigitalforge.com',
    'X-Title': 'OpenClaw-Rimuru',
  };

  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    const data = body.data ?? body;
    if (!res.ok) {
      return { ok: false, configured: true, error: body.error?.message || String(res.status) };
    }
    return {
      ok: true,
      configured: true,
      label: data.label,
      usage: data.usage,
      limit: data.limit,
      is_free_tier: data.is_free_tier,
      rate_limit: data.rate_limit,
      source: 'openrouter-auth-key',
    };
  } catch (e) {
    return { ok: false, configured: true, error: String(e.message || e) };
  }
}

export function buildLearningAdvisories({ manager, openRouter }) {
  const policy = loadTokenPolicy();
  const tips = [...(policy.learning_tips || [])];
  const advisories = [];

  const st = manager.status();
  if (st.level === 'block') {
    advisories.push({
      id: 'quota-block',
      severity: 'alta',
      mensagem: `Cota diária local ≥${policy.block_usage_pct}% — usar só scripts/Ollama até reset.`,
    });
  } else if (st.level === 'warn') {
    advisories.push({
      id: 'quota-warn',
      severity: 'media',
      mensagem: `Uso local ≥${policy.warn_usage_pct}% — preferir modelos :free e gateway read-only.`,
    });
  }

  if (openRouter?.ok && openRouter.limit != null && openRouter.usage != null) {
    const pct = openRouter.limit > 0 ? Math.round((openRouter.usage / openRouter.limit) * 100) : 0;
    if (pct >= 80) {
      advisories.push({
        id: 'openrouter-high',
        severity: 'media',
        mensagem: `OpenRouter ~${pct}% da quota da chave — rever fallbacks e tamanho de contexto.`,
      });
    }
  }

  if (!openRouter?.configured) {
    advisories.push({
      id: 'openrouter-missing',
      severity: 'baixa',
      mensagem: 'Sem OPENROUTER_API_KEY — monitor só local/EC2.',
    });
  }

  for (const tip of tips.slice(0, 3)) {
    advisories.push({ id: 'tip', severity: 'info', mensagem: tip });
  }

  return advisories;
}

function snapshotPath() {
  return resolve(root, 'data', 'rimuru', 'last-monitor.json');
}

export function saveMonitorSnapshot(payload) {
  const dir = dirname(snapshotPath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(snapshotPath(), JSON.stringify(payload, null, 2), 'utf8');
}

export function loadMonitorSnapshot() {
  const p = snapshotPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Relatório completo Rimuru.
 * @param {{ deploy?: object }} [deps]
 */
/**
 * Actividade Hub hoje (proxy de uso — workflow_runs, não tokens LLM exactos).
 */
export async function fetchHubDailyActivity() {
  try {
    const { isHubEnabled, fetchRecentHub } = await import('../../gateway/lib/hub-store.mjs');
    if (!isHubEnabled()) {
      return { configured: false, today_runs: 0, by_agent: {} };
    }
    const recent = await fetchRecentHub({ limit: 100 });
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const runs = (recent.workflow_runs || []).filter((r) => {
      if (!r.created_at) return false;
      return new Date(r.created_at) >= start;
    });
    const by_agent = {};
    for (const r of runs) {
      const a = r.route_agent || r.agent_id || 'unknown';
      by_agent[a] = (by_agent[a] || 0) + 1;
    }
    return {
      configured: true,
      today_runs: runs.length,
      by_agent,
      source: 'supabase-workflow_runs',
    };
  } catch (e) {
    return { configured: true, error: String(e.message || e), today_runs: 0, by_agent: {} };
  }
}

export async function buildTokenMonitorReport(deps = {}) {
  const policy = loadTokenPolicy();
  const snapshot = loadMonitorSnapshot();
  const usedEstimate = Number(snapshot?.estimated_tokens_today) || 0;
  const manager = createTokenManager({ usedTokens: usedEstimate });
  const openRouter = await fetchOpenRouterKeyInfo();

  if (openRouter.ok && openRouter.usage != null) {
    manager.record(Number(openRouter.usage));
  }

  const hubDaily = deps.hubDaily ?? (await fetchHubDailyActivity());
  const advisories = buildLearningAdvisories({ manager, openRouter });
  const deploy = deps.deploy ?? null;

  const report = {
    ok: true,
    source: 'rimuru-token-monitor',
    gerado_em: new Date().toISOString(),
    quota_local: manager.status(),
    openrouter: openRouter,
    hub_daily: hubDaily,
    deploy: deploy ? { ok: deploy.ok, sites: deploy.sites?.length } : null,
    advisories,
    evolution_score: Math.max(0, 100 - manager.usagePct()),
    prefer_order: policy.prefer_order,
  };

  saveMonitorSnapshot({
    at: report.gerado_em,
    estimated_tokens_today: manager.used,
    openrouter_usage: openRouter.usage ?? null,
  });

  return report;
}

export function formatMonitorTelegram(report) {
  const q = report.quota_local;
  const or = report.openrouter;
  const lines = [
    `Rimuru [tokens ${q.usagePct}% local]: restam ~${q.remaining.toLocaleString('pt-PT')} / ${q.limit.toLocaleString('pt-PT')}.`,
  ];
  if (or?.configured && or.ok) {
    const u = or.usage != null ? or.usage : '?';
    const l = or.limit != null ? or.limit : '?';
    lines.push(`OpenRouter: uso ${u} / limite ${l} (${or.label || 'chave ok'}).`);
  } else if (or?.configured === false) {
    lines.push('OpenRouter: chave não configurada no gateway.');
  }
  if (report.deploy) {
    lines.push(`Sites monitorados: ${report.deploy.ok ? 'OK' : 'atenção'}.`);
  }
  lines.push(`Evolução (eficiência): ${report.evolution_score}/100.`);
  const top = (report.advisories || []).slice(0, 3);
  if (top.length) {
    lines.push('', 'Dicas:');
    for (const a of top) lines.push(`• ${a.mensagem}`);
  }
  return lines.join('\n').slice(0, 1500);
}
