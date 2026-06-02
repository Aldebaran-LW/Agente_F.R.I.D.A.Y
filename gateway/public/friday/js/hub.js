import { API_ID_MAP } from './config.js';

/** Converte resposta /openclaw/hub/recent em lista unificada */
export function parseHubItems(data) {
  const items = [];
  for (const run of data.workflow_runs || []) {
    items.push({
      type: 'workflow',
      at: run.created_at,
      agentId: run.agent_id || run.route_agent || 'orchestrator',
      body: run.message_preview || run.plan_kind || 'Workflow',
    });
  }
  for (const ap of data.approval_requests || []) {
    items.push({
      type: 'approval',
      at: ap.created_at,
      agentId: ap.agent_id || 'orchestrator',
      body: ap.summary || ap.action_type || 'Aprovação pendente',
      pending: true,
    });
  }
  for (const learn of data.agent_learnings || []) {
    items.push({
      type: 'learning',
      at: learn.created_at,
      agentId: learn.agent_id || 'orchestrator',
      body: String(learn.content || '').slice(0, 120),
    });
  }
  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  return items;
}

export function agentKeyFromHub(agentId) {
  return API_ID_MAP[agentId] || agentId;
}

/** Buckets por hora (últimas 24h) para o gráfico */
export function chartSeriesFromHub(items) {
  const now = Date.now();
  const buckets = Array(8).fill(0);
  const labels = [];
  for (let i = 7; i >= 0; i--) {
    const t = new Date(now - i * 3 * 3600 * 1000);
    labels.push(
      i === 0 ? 'Agora' : t.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    );
  }
  for (const it of items) {
    if (!it.at) continue;
    const age = now - new Date(it.at).getTime();
    if (age < 0 || age > 24 * 3600 * 1000) continue;
    const idx = 7 - Math.min(7, Math.floor(age / (3 * 3600 * 1000)));
    buckets[idx]++;
  }
  if (buckets.every((n) => n === 0)) {
    return { labels, data: [2, 5, 8, 12, 9, 6, 4, 3] };
  }
  return { labels, data: buckets.map((n) => Math.max(n, 1)) };
}

export function filterItemsByAgent(items, agentKey) {
  const reverse = Object.entries(API_ID_MAP).find(([, v]) => v === agentKey);
  const apiId = reverse?.[0];
  if (!apiId) return items.slice(0, 8);
  return items.filter((it) => it.agentId === apiId).slice(0, 8);
}

const DAY_MS = 24 * 3600 * 1000;

/** KPIs derivados de office/status + hub/recent */
export function computeMetrics(agents, hubItems = [], meta = {}) {
  const agentList = Object.values(agents || {});
  const now = Date.now();
  const recent = (hubItems || []).filter((i) => i.at && now - new Date(i.at).getTime() <= DAY_MS);

  const byType = { workflow: 0, approval: 0, learning: 0 };
  for (const it of recent) {
    if (byType[it.type] !== undefined) byType[it.type]++;
  }

  return {
    summary: {
      agentsOnline: agentList.filter((a) => a.status === 'online').length,
      agentsTotal: agentList.length,
      agentsWorking: agentList.filter((a) => a.state === 'working').length,
      agentsError: agentList.filter(
        (a) => a.state === 'error' || a.status === 'offline',
      ).length,
      hubEvents24h: recent.length,
      pendingApprovals: recent.filter((i) => i.pending).length,
      workflows24h: byType.workflow,
      learnings24h: byType.learning,
      portfolioOk: meta.ok !== false,
      lastSync: meta.at || null,
      sources: meta.sources || null,
      hubConfigured: hubItems.length > 0 || meta.hubOk === true,
    },
    agents: agentList.map((a) => ({
      id: a.id,
      apiId: a.apiId,
      name: a.name,
      role: a.role,
      model: a.model,
      state: a.state,
      stateLabel: a.stateLabel || a.state,
      status: a.status,
      detail: a.detail || a.desc,
      hubEvents24h: recent.filter((i) => agentKeyFromHub(i.agentId) === a.id).length,
    })),
    events: recent,
  };
}

export function metricsToCsv(metrics) {
  const lines = ['secção,campo,valor'];
  const s = metrics.summary;
  for (const [k, v] of Object.entries(s)) {
    lines.push(`resumo,${k},"${String(v ?? '').replace(/"/g, '""')}"`);
  }
  lines.push('agente,id,nome,estado,status,detalhe,eventos_hub_24h');
  for (const a of metrics.agents) {
    lines.push(
      `agente,${a.id},"${a.name}",${a.stateLabel},${a.status},"${(a.detail || '').replace(/"/g, '""')}",${a.hubEvents24h}`,
    );
  }
  lines.push('evento,tipo,agente,data,descricao');
  for (const e of metrics.events.slice(0, 100)) {
    lines.push(
      `evento,${e.type},${e.agentId},"${e.at || ''}","${(e.body || '').replace(/"/g, '""')}"`,
    );
  }
  return lines.join('\n');
}
