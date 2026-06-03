const TOKEN_KEY = 'openclaw_office_token';
const POLL_MS = 30_000;

const AGENT_META = {
  orchestrator: { emoji: '🧠', name: 'Jarvis', role: 'Cérebro' },
  macofel: { emoji: '📦', name: 'Macofel', role: 'Catálogo' },
  heimdall: { emoji: '🛡️', name: 'Heimdall', role: 'Observador' },
  'vp-pecas': { emoji: '⚡', name: 'VP-Peças', role: 'Usinagem' },
};

const FALLBACK_AGENTS = [
  {
    id: 'orchestrator',
    name: 'Jarvis',
    role: 'Cérebro',
    state: 'idle',
    stateLabel: 'ocioso',
    detail: 'Portfólio estável',
  },
  {
    id: 'macofel',
    name: 'Macofel',
    role: 'Catálogo',
    state: 'working',
    stateLabel: 'trabalhando',
    detail: '21.799 imagens pendentes',
  },
  {
    id: 'heimdall',
    name: 'Heimdall',
    role: 'Observador',
    state: 'working',
    stateLabel: 'trabalhando',
    detail: '1 issue · deploys OK',
  },
  {
    id: 'vp-pecas',
    name: 'VP-Peças',
    role: 'Usinagem',
    state: 'idle',
    stateLabel: 'ocioso',
    detail: 'Online (~77ms)',
  },
];

const PANEL_TITLES = {
  overview: 'Visão Geral',
  agents: 'Agentes',
  innovation: 'Inovação',
  settings: 'Configurações',
};

const $ = (id) => document.getElementById(id);

function baseUrl() {
  return window.location.origin.replace(/\/$/, '');
}

function getToken() {
  return ($('token')?.value || sessionStorage.getItem(TOKEN_KEY) || '').trim();
}

function saveToken() {
  const t = $('token')?.value.trim() || '';
  if (t) sessionStorage.setItem(TOKEN_KEY, t);
  else sessionStorage.removeItem(TOKEN_KEY);
  setStatus(t ? 'Token guardado nesta sessão.' : 'Token removido.');
  refreshAll();
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  if ($('token')) $('token').value = '';
  setStatus('Token removido.');
}

function setStatus(msg, isErr = false) {
  const el = $('status-line');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('err', isErr);
}

function authHeaders() {
  const token = getToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

function readTokenFromHash() {
  const raw = window.location.hash.replace(/^#/, '').trim();
  if (!raw) return;
  let t = '';
  if (raw.startsWith('token=')) t = raw.slice('token='.length);
  else {
    try {
      t = new URLSearchParams(raw).get('token') || '';
    } catch {
      t = '';
    }
  }
  t = decodeURIComponent(t).trim();
  if (!t) return;
  sessionStorage.setItem(TOKEN_KEY, t);
  if ($('token')) $('token').value = t;
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

function switchPanel(panelId) {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.panel === panelId);
  });
  document.querySelectorAll('.panel').forEach((sec) => {
    const on = sec.dataset.panel === panelId;
    sec.classList.toggle('active', on);
    sec.hidden = !on;
  });
  $('panel-title').textContent = PANEL_TITLES[panelId] || panelId;
  $('sidebar')?.classList.remove('open');
  $('sidebar-backdrop').hidden = true;
}

function renderOverview(agents) {
  const grid = $('overview-cards');
  if (!grid) return;
  grid.innerHTML = agents
    .map((a) => {
      const meta = AGENT_META[a.id] || { emoji: '◆', name: a.name, role: a.role };
      return `
        <article class="card overview-card">
          <div class="overview-card-head">
            <span class="overview-emoji">${meta.emoji}</span>
            <div>
              <h3>${meta.name}</h3>
              <span class="role">${meta.role}</span>
            </div>
          </div>
          <div class="overview-state state-${a.state}">
            <span class="status-dot ${a.state === 'error' ? 'err' : a.state === 'idle' ? 'ok' : 'warn'}"></span>
            ${a.stateLabel}
          </div>
          <p class="overview-detail">${escapeHtml(a.detail)}</p>
        </article>`;
    })
    .join('');
}

function renderAgentsTable(agents) {
  const tbody = $('agents-table-body');
  if (!tbody) return;
  tbody.innerHTML = agents
    .map(
      (a) => `
    <tr>
      <td>${escapeHtml(AGENT_META[a.id]?.name || a.name)}</td>
      <td>${escapeHtml(a.role)}</td>
      <td><span class="badge-pill state-${a.state}">${escapeHtml(a.stateLabel)}</span></td>
      <td class="mono">${escapeHtml(a.detail)}</td>
    </tr>`
    )
    .join('');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchOffice() {
  const headers = authHeaders();
  if (!headers) {
    setStatus('Introduz o token em Configurações e guarda a sessão.', true);
    renderOverview(FALLBACK_AGENTS);
    renderAgentsTable(FALLBACK_AGENTS);
    return null;
  }

  setStatus('A actualizar…');
  const res = await fetch(`${baseUrl()}/openclaw/office/status`, { headers });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    setStatus('Token inválido.', true);
    return null;
  }
  if (!res.ok) {
    setStatus(body.error || `Erro HTTP ${res.status}`, true);
    renderOverview(FALLBACK_AGENTS);
    renderAgentsTable(FALLBACK_AGENTS);
    return null;
  }

  const agents = body.agents || FALLBACK_AGENTS;
  renderOverview(agents);
  renderAgentsTable(agents);

  const labels = agents.map((a) => a.stateLabel).join(' · ');
  const at = body.at ? new Date(body.at).toLocaleTimeString('pt-PT') : '—';
  setStatus(`OK · ${at} · ${labels}`, !body.ok);
  $('overview-meta').textContent = `Fontes: macofel ${body.sources?.macofel ? '✓' : '✗'} · github ${body.sources?.github ? '✓' : '✗'} · deploy ${body.sources?.deploy ? '✓' : '✗'}`;

  return body;
}

function formatInnovation(data) {
  if (!data.ok) return data.error || 'Sem dados';
  const lines = [];
  if (data.predictions?.length) {
    lines.push('Predições (≥70):');
    for (const p of data.predictions) {
      lines.push(`  · ${p.topico || p.file} — score ${p.score}`);
    }
  } else lines.push('Predições ≥70: nenhuma no período.');
  if (data.knowledge?.length) lines.push(`Conhecimento: ${data.knowledge.length} entradas`);
  if (data.market?.length) lines.push(`Mercado: ${data.market.length} entradas`);
  if (data.analysis?.length) lines.push(`Análises Senku: ${data.analysis.length}`);
  if (data.ultimo_pipeline) {
    lines.push(`Último: ${data.ultimo_pipeline.file} (${data.ultimo_pipeline.at})`);
  }
  lines.push(`Fonte: ${data.source}`);
  return lines.join('\n');
}

async function fetchInnovation() {
  const headers = authHeaders();
  const el = $('innovation-body');
  if (!headers) {
    el.textContent = 'Token necessário.';
    return;
  }
  el.textContent = 'A carregar…';
  const res = await fetch(`${baseUrl()}/openclaw/innovation/status?days=7`, { headers });
  const body = await res.json().catch(() => ({}));
  el.textContent = res.ok ? formatInnovation(body) : body.error || `HTTP ${res.status}`;
}

function hubItems(data) {
  const items = [];
  for (const run of data.workflow_runs || []) {
    items.push({
      type: 'workflow',
      at: run.created_at,
      agent: run.agent_id || run.route_agent || 'orchestrator',
      body: run.message_preview || run.plan_kind || 'Workflow',
    });
  }
  for (const ap of data.approval_requests || []) {
    items.push({
      type: 'approval',
      at: ap.created_at,
      agent: ap.agent_id || 'orchestrator',
      body: ap.summary || ap.action_type || 'Aprovação pendente',
      pending: true,
    });
  }
  for (const learn of data.agent_learnings || []) {
    items.push({
      type: 'learning',
      at: learn.created_at,
      agent: learn.agent_id || '—',
      body: String(learn.content || '').slice(0, 160),
    });
  }
  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  return items.slice(0, 12);
}

function renderActivityFeed(items) {
  const feed = $('activity-feed');
  if (!feed) return;
  if (!items.length) {
    feed.innerHTML = '<li class="activity-empty">Nenhuma actividade recente no Hub.</li>';
    return;
  }
  feed.innerHTML = items
    .map((it) => {
      const time = it.at ? new Date(it.at).toLocaleString('pt-PT') : '—';
      const typeLabel =
        it.type === 'approval'
          ? 'Aprovação'
          : it.type === 'learning'
            ? 'Aprendizado'
            : 'Workflow';
      return `
      <li class="activity-item${it.pending ? ' pending' : ''}">
        <div class="activity-meta">
          <span class="activity-type">${typeLabel}</span>
          <span>${escapeHtml(it.agent)}</span>
          <span>${time}</span>
        </div>
        <p class="activity-body">${escapeHtml(it.body)}${it.pending ? ' · aguarda <em>sim</em> no Telegram' : ''}</p>
      </li>`;
    })
    .join('');
}

async function fetchHubRecent() {
  const headers = authHeaders();
  const feed = $('activity-feed');
  if (!headers) {
    feed.innerHTML = '<li class="activity-empty">Token necessário — Configurações.</li>';
    return;
  }
  feed.innerHTML = '<li class="activity-empty">A carregar Hub…</li>';
  const res = await fetch(`${baseUrl()}/openclaw/hub/recent?limit=15&snapshots=0`, {
    headers,
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 503 && body.error === 'supabase_not_configured') {
    feed.innerHTML =
      '<li class="activity-empty">Hub Supabase não configurado na Vercel. Ver docs/SUPABASE-CENTRAL.md</li>';
    return;
  }
  if (!res.ok) {
    feed.innerHTML = `<li class="activity-empty">${escapeHtml(body.error || 'Erro ao carregar Hub')}</li>`;
    return;
  }
  renderActivityFeed(hubItems(body));
}

async function checkGatewayHealth() {
  try {
    const res = await fetch(`${baseUrl()}/api/health`, { cache: 'no-store' });
    const ok = res.ok;
    const dot = $('sidebar-status-dot');
    const text = $('sidebar-status-text');
    if (dot) dot.className = 'status-dot' + (ok ? ' ok' : ' err');
    if (text) text.textContent = ok ? 'Gateway online' : 'Gateway offline';
  } catch {
    const dot = $('sidebar-status-dot');
    if (dot) dot.className = 'status-dot err';
    $('sidebar-status-text').textContent = 'Gateway offline';
  }
}

function refreshAll() {
  checkGatewayHealth();
  fetchOffice();
  fetchInnovation();
  fetchHubRecent();
}

function tickClock() {
  const el = $('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-PT');
}

function initSidebar() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });
  $('menu-toggle')?.addEventListener('click', () => {
    $('sidebar').classList.add('open');
    $('sidebar-backdrop').hidden = false;
  });
  $('sidebar-backdrop')?.addEventListener('click', () => {
    $('sidebar').classList.remove('open');
    $('sidebar-backdrop').hidden = true;
  });
}

function init() {
  readTokenFromHash();
  const saved = sessionStorage.getItem(TOKEN_KEY);
  if (saved && $('token')) $('token').value = saved;

  initSidebar();
  $('save-token')?.addEventListener('click', saveToken);
  $('clear-token')?.addEventListener('click', clearToken);
  $('refresh')?.addEventListener('click', refreshAll);

  tickClock();
  setInterval(tickClock, 1000);
  setInterval(refreshAll, POLL_MS);

  refreshAll();
}

init();
