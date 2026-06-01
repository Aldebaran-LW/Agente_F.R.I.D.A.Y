/**
 * Heimdall — observador de fluxo do ecossistema (Node.js, sem LLM).
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');

let watchCache = null;

export function loadWatchConfig() {
  if (watchCache) return watchCache;
  const p = resolve(root, 'agents', 'heimdall', 'watch-agents.json');
  watchCache = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { agents: [] };
  return watchCache;
}

function agentRule(agentId) {
  return (loadWatchConfig().agents || []).find((a) => a.id === agentId);
}

/**
 * Valida se a última skill no Hub está no contexto do agente.
 */
export function checkAgentContext(run) {
  if (!run?.route_agent) return { ok: true, reason: 'sem run' };
  const rule = agentRule(run.route_agent);
  if (!rule) return { ok: true, reason: 'agente sem regras' };
  const skill = run.route_skill;
  if (!skill) return { ok: true };
  if (rule.forbidden_skills?.includes(skill)) {
    return {
      ok: false,
      violation: true,
      reason: `skill proibida ${skill} para ${run.route_agent}`,
    };
  }
  if (rule.allowed_skills?.length && !rule.allowed_skills.includes(skill)) {
    return {
      ok: false,
      violation: true,
      reason: `skill ${skill} fora do contexto de ${run.route_agent} (esperado: ${rule.allowed_skills.join(', ')})`,
    };
  }
  return { ok: true, skill };
}

export async function fetchHubAgentActivity({ limit = 40 } = {}) {
  try {
    const { isHubEnabled, fetchRecentHub } = await import('../../gateway/lib/hub-store.mjs');
    if (!isHubEnabled()) {
      return { configured: false, runs: [], by_agent: {} };
    }
    const recent = await fetchRecentHub({ limit });
    const runs = recent.workflow_runs || [];
    const by_agent = {};
    const staleMs = (loadWatchConfig().stale_minutes || 45) * 60 * 1000;
    const now = Date.now();

    for (const run of runs) {
      const id = run.route_agent || run.agent_id;
      if (!id) continue;
      if (!by_agent[id] || new Date(run.created_at) > new Date(by_agent[id].created_at)) {
        by_agent[id] = run;
      }
    }

    const innovation = [];
    for (const rule of loadWatchConfig().agents || []) {
      if (['macofel', 'vp-pecas', 'heimdall', 'orchestrator'].includes(rule.id)) continue;
      const last = by_agent[rule.id];
      let state = 'idle';
      let detail = 'sem atividade recente no Hub';
      if (last?.created_at) {
        const age = now - new Date(last.created_at).getTime();
        if (age < staleMs) {
          state = 'working';
          detail = `${last.route_skill || 'pedido'} (${Math.round(age / 60000)} min)`;
        } else {
          state = 'idle';
          detail = `último: ${last.route_skill || '?'} há ${Math.round(age / 60000)} min`;
        }
      }
      const ctx = last ? checkAgentContext(last) : { ok: true };
      innovation.push({
        id: rule.id,
        name: rule.label || rule.id,
        role: 'Inovação/suporte',
        state: ctx.violation ? 'error' : state,
        stateLabel: ctx.violation ? 'contexto' : state,
        detail: ctx.violation ? ctx.reason : detail,
        context_ok: ctx.ok !== false,
        last_skill: last?.route_skill ?? null,
      });
    }

    return { configured: true, runs, by_agent, innovation };
  } catch (e) {
    return { configured: true, error: String(e.message || e), runs: [], by_agent: {}, innovation: [] };
  }
}

async function fetchOfficeSnapshotSafe() {
  const base = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
  const token = process.env.OPENCLAW_AUTOMATION_TOKEN?.trim();
  if (base && token) {
    try {
      const res = await fetch(`${base}/openclaw/office/status`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(25000),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.agents) return body;
    } catch {
      /* fallback import */
    }
  }
  try {
    const { fetchOfficeSnapshot } = await import('../../gateway/lib/office.mjs');
    return await fetchOfficeSnapshot();
  } catch (e) {
    return {
      ok: false,
      busy: false,
      agents: [],
      sources: {},
      error: String(e.message || e),
      at: new Date().toISOString(),
    };
  }
}

export async function buildFlowMonitorReport() {
  const cfg = loadWatchConfig();
  const [office, hub] = await Promise.all([
    fetchOfficeSnapshotSafe(),
    fetchHubAgentActivity(),
  ]);

  const violations = [];
  for (const run of hub.runs || []) {
    const ctx = checkAgentContext(run);
    if (ctx.violation) {
      violations.push({
        agent: run.route_agent,
        skill: run.route_skill,
        reason: ctx.reason,
        at: run.created_at,
      });
    }
  }

  const operational = (office.agents || []).map((a) => {
    const last = hub.by_agent?.[a.id];
    const ctx = last ? checkAgentContext(last) : { ok: true };
    return {
      ...a,
      context_ok: ctx.ok !== false,
      context_note: ctx.violation ? ctx.reason : null,
      last_hub_skill: last?.route_skill ?? null,
    };
  });

  const allAgents = [...operational, ...(hub.innovation || [])];
  const errors = allAgents.filter((a) => a.state === 'error' || a.context_ok === false);
  const working = allAgents.filter((a) => a.state === 'working');
  const deployOk = office.sources?.deploy !== false;

  const staleThresholdMin =
    Number(process.env.HEARTBEAT_AGENT_STALE_MIN) || cfg.stale_minutes || 60;

  function hubAgeMin(agentId) {
    const last = hub.by_agent?.[agentId];
    if (!last?.created_at) return null;
    return Math.round((Date.now() - new Date(last.created_at).getTime()) / 60000);
  }

  const agent_activity = {};
  const stale_agents = [];
  for (const a of allAgents) {
    const age = hubAgeMin(a.id);
    let activity = a.state;
    if (hub.configured && age != null && age > staleThresholdMin && a.state !== 'error') {
      activity = 'stale';
      stale_agents.push({ id: a.id, name: a.name, idle_minutes: age });
    } else if (hub.configured && age == null && a.state === 'idle') {
      activity = 'stale';
      stale_agents.push({ id: a.id, name: a.name, idle_minutes: null });
    }
    agent_activity[a.id] = activity;
  }

  const alerts = [];
  if (!office.ok) alerts.push({ id: 'office-degraded', severity: 'alta', mensagem: 'Portfólio com erro (office snapshot).' });
  if (!deployOk) alerts.push({ id: 'deploy-down', severity: 'alta', mensagem: 'Deploy/health com falha.' });
  for (const v of violations.slice(0, 5)) {
    alerts.push({
      id: 'context',
      severity: 'media',
      mensagem: `${v.agent}: ${v.reason}`,
    });
  }
  if (stale_agents.length > 0 && stale_agents.length <= 3) {
    for (const s of stale_agents) {
      alerts.push({
        id: 'stale',
        severity: 'baixa',
        mensagem: `${s.name}: sem atividade Hub há ${s.idle_minutes ?? '>' + staleThresholdMin} min`,
      });
    }
  }

  return {
    ok: errors.length === 0 && office.ok,
    source: 'heimdall-flow-monitor',
    gerado_em: new Date().toISOString(),
    office_ok: office.ok,
    busy: office.busy || working.length > 0,
    operational,
    innovation: hub.innovation || [],
    working_count: working.length,
    error_count: errors.length,
    context_violations: violations,
    alerts,
    should_notify: alerts.length > 0,
    hub_configured: hub.configured,
    agent_activity,
    stale_agents,
    policy: 'Silencioso se tudo OK; alertas em transição via heartbeat.',
  };
}

function snapshotPath() {
  return resolve(root, 'data', 'heimdall', 'last-flow.json');
}

export function saveFlowSnapshot(report) {
  const dir = dirname(snapshotPath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(snapshotPath(), JSON.stringify(report, null, 2), 'utf8');
}

export function formatFlowTelegram(report) {
  if (!report.should_notify && report.ok) {
    return 'Heimdall: ecossistema OK — sem alertas.';
  }
  const lines = [
    `Heimdall [fluxo]: ${report.error_count} erro(s), ${report.working_count} ativo(s).`,
    `Office: ${report.office_ok ? 'OK' : 'atenção'}.`,
  ];
  for (const a of [...(report.operational || []), ...(report.innovation || [])].filter(
    (x) => x.state === 'error' || x.context_ok === false
  ).slice(0, 6)) {
    lines.push(`• ${a.name}: ${a.detail}${a.context_note ? ` — ${a.context_note}` : ''}`);
  }
  for (const al of (report.alerts || []).slice(0, 4)) {
    lines.push(`⚠ ${al.mensagem}`);
  }
  return lines.join('\n').slice(0, 1500);
}
