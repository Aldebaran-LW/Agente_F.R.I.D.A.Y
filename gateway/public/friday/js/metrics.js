import { agentKeyFromHub, computeMetrics, metricsToCsv } from './hub.js';

let lastMetrics = null;
let filterAgent = 'all';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function kpiCard(label, value, sub = '') {
  return `<article class="kpi-card rounded-xl border border-slate-700 glass-panel p-6 text-center">
    <p class="text-sm text-slate-400">${escapeHtml(label)}</p>
    <p class="mt-2 font-mono text-4xl text-brand-cyan">${escapeHtml(value)}</p>
    ${sub ? `<p class="mt-1 font-mono text-xs text-slate-500">${escapeHtml(sub)}</p>` : ''}
  </article>`;
}

export function renderMetrics(agents, hubItems, meta) {
  lastMetrics = computeMetrics(agents, hubItems, { ...meta, hubOk: (hubItems?.length ?? 0) > 0 });
  const s = lastMetrics.summary;

  const kpis = document.getElementById('metrics-kpis');
  if (kpis) {
    kpis.innerHTML = [
      kpiCard('Agentes activos', `${s.agentsOnline}/${s.agentsTotal}`, 'office/status'),
      kpiCard('A trabalhar', String(s.agentsWorking), 'estado working'),
      kpiCard('Erros / offline', String(s.agentsError), 'requer atenção'),
      kpiCard('Eventos Hub (24h)', String(s.hubEvents24h), 'hub/recent'),
      kpiCard('Aprovações pendentes', String(s.pendingApprovals), 'aguardam sim'),
      kpiCard('Workflows (24h)', String(s.workflows24h), ''),
      kpiCard('Aprendizados (24h)', String(s.learnings24h), ''),
      kpiCard(
        'Portfólio',
        s.portfolioOk ? 'OK' : 'Incidente',
        s.lastSync ? new Date(s.lastSync).toLocaleString('pt-PT') : '—',
      ),
    ].join('');
  }

  const sources = document.getElementById('metrics-sources');
  if (sources) {
    if (s.sources) {
      const src = s.sources;
      sources.textContent = `Fontes: Macofel ${src.macofel ? '✓' : '✗'} · GitHub ${src.github ? '✓' : '✗'} · Deploy ${src.deploy ? '✓' : '✗'}`;
      sources.classList.remove('hidden');
    } else {
      sources.classList.add('hidden');
    }
  }

  populateAgentFilter();
  renderAgentsTable();
  renderEventsTable();
}

function populateAgentFilter() {
  const sel = document.getElementById('metrics-filter-agent');
  if (!sel || !lastMetrics) return;
  const prev = sel.value || filterAgent;
  sel.innerHTML =
    '<option value="all">Todos os agentes</option>' +
    lastMetrics.agents
      .map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`)
      .join('');
  sel.value = prev;
}

function renderAgentsTable() {
  const tbody = document.getElementById('metrics-agents-body');
  if (!tbody || !lastMetrics) return;

  const rows = lastMetrics.agents.filter(
    (a) => filterAgent === 'all' || a.id === filterAgent,
  );

  tbody.innerHTML =
    rows.length === 0
      ? '<tr><td colspan="4" class="activity-empty">Sem dados</td></tr>'
      : rows
          .map(
            (a) => `<tr>
      <td>${escapeHtml(a.name)}</td>
      <td><span class="status-pill ${a.status === 'online' ? 'on' : 'off'}">${escapeHtml(a.stateLabel)}</span></td>
      <td class="mono">${escapeHtml(a.detail)}</td>
      <td class="mono">${a.hubEvents24h}</td>
    </tr>`,
          )
          .join('');
}

function renderEventsTable() {
  const tbody = document.getElementById('metrics-events-body');
  if (!tbody || !lastMetrics) return;

  let events = lastMetrics.events;
  if (filterAgent !== 'all') {
    events = events.filter((e) => agentKeyFromHub(e.agentId) === filterAgent);
  }

  tbody.innerHTML =
    events.length === 0
      ? '<tr><td colspan="4" class="activity-empty">Sem eventos Hub nas últimas 24h</td></tr>'
      : events
          .slice(0, 50)
          .map((e) => {
            const time = e.at ? new Date(e.at).toLocaleString('pt-PT') : '—';
            return `<tr>
        <td class="mono">${escapeHtml(e.type)}</td>
        <td>${escapeHtml(agentKeyFromHub(e.agentId))}</td>
        <td class="mono">${escapeHtml(time)}</td>
        <td>${escapeHtml(e.body)}${e.pending ? ' <em>(pendente)</em>' : ''}</td>
      </tr>`;
          })
          .join('');
}

export function initMetricsUi() {
  document.getElementById('metrics-filter-agent')?.addEventListener('change', (e) => {
    filterAgent = e.target.value;
    renderAgentsTable();
    renderEventsTable();
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    if (!lastMetrics) return;
    downloadFile('openclaw-metrics.csv', metricsToCsv(lastMetrics), 'text/csv');
  });

  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    if (!lastMetrics) return;
    downloadFile(
      'openclaw-metrics.json',
      JSON.stringify(lastMetrics, null, 2),
      'application/json',
    );
  });
}

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function getLastMetrics() {
  return lastMetrics;
}
