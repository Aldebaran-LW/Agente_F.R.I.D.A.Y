import { fridayApi } from './api.js';
import { agentKeyFromHub, chartSeriesFromHub } from './hub.js';

let trafficChart = null;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const NEON_SHADOW = {
  '#3b82f6': 'hover:shadow-neon-blue',
  '#10b981': 'hover:shadow-neon-emerald',
  '#8b5cf6': 'hover:shadow-neon-purple',
  '#f59e0b': 'hover:shadow-neon-amber',
};

export function renderHomeCards(agents) {
  const grid = document.getElementById('home-agents-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.values(agents).forEach((agent) => {
    const isOnline = agent.status === 'online';
    const neon = NEON_SHADOW[agent.color] || 'hover:shadow-neon-blue';
    const card = document.createElement('article');
    card.className = `agent-card glass-panel clickable relative overflow-hidden rounded-2xl border border-slate-800 p-6 transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] hover:border-white/20 ${neon}`;
    card.innerHTML = `
      <div class="pointer-events-none absolute right-4 top-4 opacity-10" style="color:${agent.color}">
        <i data-lucide="${agent.icon}" class="h-20 w-20"></i>
      </div>
      <div class="relative z-10">
        <div class="mb-4 flex items-start justify-between">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border" style="border-color:${agent.color}55;background:${agent.color}18;color:${agent.color}">
            <i data-lucide="${agent.icon}" class="h-6 w-6"></i>
          </div>
          <span class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'border-brand-emerald/50 text-brand-emerald' : 'border-red-500/50 text-red-400'}">
            <span class="h-2 w-2 rounded-full ${isOnline ? 'animate-pulse bg-brand-emerald' : 'bg-red-500'}"></span>
            ${isOnline ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        <h3 class="font-display text-xl font-bold text-white">${escapeHtml(agent.name)}</h3>
        <p class="mt-1 font-mono text-xs" style="color:${agent.color}">${escapeHtml(agent.model)}</p>
        <p class="mt-4 text-sm font-light leading-relaxed text-slate-400">${escapeHtml(agent.desc || agent.detail)}</p>
        <p class="mt-3 font-mono text-xs text-slate-500">${escapeHtml(agent.stateLabel || agent.detail || agent.state || '—')}</p>
      </div>
    `;
    grid.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

export function renderActivityFeed(items, error) {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;

  if (error === 'no_token') {
    feed.innerHTML =
      '<li class="activity-empty">Token necessário para actividade do Hub.</li>';
    return;
  }
  if (error === 'supabase_not_configured') {
    feed.innerHTML =
      '<li class="activity-empty">Hub Supabase não configurado na Vercel.</li>';
    return;
  }
  if (error) {
    feed.innerHTML = `<li class="activity-empty">${escapeHtml(error)}</li>`;
    return;
  }
  if (!items?.length) {
    feed.innerHTML = '<li class="activity-empty">Nenhuma actividade recente.</li>';
    return;
  }

  feed.innerHTML = items
    .slice(0, 8)
    .map((it) => {
      const key = agentKeyFromHub(it.agentId);
      const time = it.at ? new Date(it.at).toLocaleString('pt-PT') : '—';
      const typeLabel =
        it.type === 'approval' ? 'Aprovação' : it.type === 'learning' ? 'Aprendizado' : 'Workflow';
      return `<li class="activity-item${it.pending ? ' pending' : ''}">
        <div class="activity-meta">
          <span class="activity-type">${typeLabel}</span>
          <span>${escapeHtml(key)}</span>
          <span>${escapeHtml(time)}</span>
        </div>
        <p class="activity-body">${escapeHtml(it.body)}${it.pending ? ' · aguarda <em>sim</em>' : ''}</p>
      </li>`;
    })
    .join('');
}

export function updateSyncBadge(result) {
  const dot = document.getElementById('api-dot');
  const ping = document.getElementById('api-ping');
  const text = document.getElementById('sys-status');
  const time = document.getElementById('last-sync-time');
  if (!dot || !text) return;

  const modes = {
    live: { cls: 'on', label: 'API Conectada' },
    cache: { cls: 'warn', label: 'Modo Cache (offline)' },
    mock: { cls: 'warn', label: 'Modo Demo (sem token)' },
  };
  const m = modes[result.mode] || modes.mock;

  if (result.error === 'unauthorized') {
    dot.className = 'api-dot err';
    if (ping) ping.className = 'api-ping hidden';
    text.textContent = 'Token inválido';
    return;
  }

  dot.className = `api-dot ${m.cls}`;
  if (ping) ping.className = `api-ping ${m.cls === 'on' ? '' : 'hidden'}`;
  text.textContent = m.label;

  if (time && fridayApi.lastMeta.at) {
    time.textContent =
      'Atualizado: ' + new Date(fridayApi.lastMeta.at).toLocaleTimeString('pt-PT');
  }
}

export function initChart() {
  const canvas = document.getElementById('trafficChart');
  if (!canvas || trafficChart || typeof Chart === 'undefined') return;

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
  gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');

  const { labels, data } = chartSeriesFromHub([]);

  trafficChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Eventos Hub (24h)',
          data,
          borderColor: '#06b6d4',
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { display: false, beginAtZero: true },
        x: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#94a3b8', font: { family: 'Geist Mono', size: 10 } },
        },
      },
    },
  });
}

export function updateChartFromHub(items) {
  if (!trafficChart) return;
  const { labels, data } = chartSeriesFromHub(items || []);
  trafficChart.data.labels = labels;
  trafficChart.data.datasets[0].data = data;
  trafficChart.update('none');
}

export function bumpChart() {
  updateChartFromHub(fridayApi.lastHub?.items || []);
}
