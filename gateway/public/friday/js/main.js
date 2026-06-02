import { POLL_MS } from './config.js';
import { fridayApi } from './api.js';
import {
  renderHomeCards,
  updateSyncBadge,
  initChart,
  bumpChart,
  renderActivityFeed,
  updateChartFromHub,
} from './home.js';
import { SalaDeTrabalho } from './salaTrabalho.js';
import { RedeNeural3D } from './redeNeural.js';
import { renderMetrics, initMetricsUi } from './metrics.js';
import { initPlayground, onPlaygroundViewActive } from './playground.js';
import {
  debounce,
  initCustomCursor,
  initSwipeNav,
  showToast,
  swipeRoute,
  toggleCursorPref,
} from './utils.js';

let currentAgents = {};
let canvasApp = null;
let threeApp = null;
let pollTimer = null;
let chartInited = false;

const getAgents = () => currentAgents;
const getHubItems = () => fridayApi.lastHub?.items || [];

function showTokenModal(required = false) {
  const modal = document.getElementById('token-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.dataset.required = required ? '1' : '0';
  document.getElementById('token-input')?.focus();
}

function hideTokenModal() {
  const modal = document.getElementById('token-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('flex');
}

async function syncStatus(manual = false) {
  const btn = document.getElementById('btn-sync');
  btn?.querySelector('i')?.classList.add('spin');

  const result = await fridayApi.fetchStatus();
  currentAgents = result.agents;

  const hub = await fridayApi.fetchHubRecent(20);
  renderActivityFeed(hub.items, hub.error);
  updateChartFromHub(hub.items);

  if (hub.ok && canvasApp) {
    canvasApp.pushHubLogs(hub.items);
  }

  updateSyncBadge(result);
  renderHomeCards(currentAgents);
  renderMetrics(currentAgents, hub.items, {
    ok: result.mode === 'live' ? fridayApi.lastMeta.ok : null,
    at: fridayApi.lastMeta.at,
    sources: fridayApi.lastMeta.sources,
  });

  if (manual) bumpChart();

  if (result.error === 'unauthorized') {
    showToast('Token inválido — verifica OPENCLAW_AUTOMATION_TOKEN', 'error');
    showTokenModal(true);
  } else if (result.error === 'no_token') {
    if (manual) showToast('Introduz o token para dados reais', 'warn');
  } else if (result.mode === 'live') {
    if (manual) showToast('Sincronizado com o gateway', 'ok');
  } else if (result.mode === 'cache') {
    showToast('API indisponível — cache local', 'warn');
  }

  if (threeApp?.isRunning) threeApp.refreshColors();
  if (canvasApp?.isRunning) canvasApp.updatePositions();

  btn?.querySelector('i')?.classList.remove('spin');
  return result;
}

function handleRoute() {
  if (document.hidden) return;

  const hash = window.location.hash || '#home';

  document.querySelectorAll('.view-container').forEach((el) => {
    el.classList.toggle('active', el.id === `view-${hash.slice(1)}`);
  });

  document.querySelectorAll('.nav-link').forEach((link) => {
    const on = link.getAttribute('href') === hash;
    link.classList.toggle('text-brand-cyan', on);
    link.classList.toggle('text-slate-400', !on);
    link.classList.toggle('active', on);
  });

  document.getElementById('home-blobs').style.display = hash === '#home' ? 'block' : 'none';

  if (window.lucide) lucide.createIcons();

  if (hash === '#sala') {
    if (!canvasApp) canvasApp = new SalaDeTrabalho(getAgents);
    canvasApp.start();
    threeApp?.pause();
  } else if (hash === '#rede') {
    if (!threeApp) {
      threeApp = new RedeNeural3D(getAgents, getHubItems, () => fridayApi.lastMeta?.connected === true);
    } else threeApp.refreshColors();
    threeApp.start();
    canvasApp?.pause();
  } else if (hash === '#metrics') {
    canvasApp?.pause();
    threeApp?.pause();
  } else if (hash === '#playground') {
    canvasApp?.pause();
    threeApp?.pause();
    onPlaygroundViewActive();
  } else {
    canvasApp?.pause();
    threeApp?.pause();
    if (!chartInited) {
      initChart();
      chartInited = true;
      updateChartFromHub(fridayApi.lastHub?.items || []);
    }
  }
}

function onVisibilityChange() {
  if (document.hidden) {
    canvasApp?.pause();
    threeApp?.pause();
    return;
  }
  handleRoute();
}

function saveTokenFromModal() {
  const input = document.getElementById('token-input');
  const token = input?.value.trim() || '';
  if (!token) {
    showToast('Token vazio', 'error');
    return;
  }
  fridayApi.setToken(token);
  hideTokenModal();
  showToast('Token guardado nesta sessão', 'ok');
  syncStatus(true);
}

function clearToken() {
  fridayApi.setToken('');
  document.getElementById('token-input').value = '';
  showToast('Token removido', 'info');
  syncStatus(true);
}

function initTokenUi() {
  fridayApi.readTokenFromHash();
  const existing = fridayApi.getToken();
  if (existing) document.getElementById('token-input').value = existing;
  else showTokenModal(false);

  document.getElementById('btn-save-token')?.addEventListener('click', saveTokenFromModal);
  document.getElementById('btn-clear-token')?.addEventListener('click', clearToken);
  document.getElementById('btn-close-token')?.addEventListener('click', () => {
    if (document.getElementById('token-modal')?.dataset.required === '1') return;
    hideTokenModal();
  });
  document.getElementById('btn-open-token')?.addEventListener('click', () => showTokenModal(false));
}

function initControls() {
  document.getElementById('btn-sync')?.addEventListener('click', () => syncStatus(true));
  document.getElementById('btn-reset-cam')?.addEventListener('click', () => threeApp?.resetCamera());
  document.getElementById('btn-auto-rotate')?.addEventListener('click', (e) => {
    const on = threeApp?.toggleAutoRotate();
    e.currentTarget.classList.toggle('active', on);
    showToast(on ? 'Rotação automática ON' : 'Rotação automática OFF');
  });
  document.getElementById('btn-focus-rede')?.addEventListener('click', () => {
    window.location.hash = '#rede';
    document.getElementById('view-rede')?.classList.add('focus-mode');
  });
  document.getElementById('btn-exit-focus')?.addEventListener('click', () => {
    document.getElementById('view-rede')?.classList.remove('focus-mode');
  });
  document.getElementById('btn-cursor-pref')?.addEventListener('click', toggleCursorPref);

  document.getElementById('sala-modal-close')?.addEventListener('click', () => {
    const m = document.getElementById('sala-modal');
    m?.classList.add('hidden');
    m?.classList.remove('flex');
  });
}

async function init() {
  if (window.lucide) lucide.createIcons();

  initCustomCursor();
  initSwipeNav(swipeRoute);
  initTokenUi();
  initControls();
  initMetricsUi();
  initPlayground();

  window.addEventListener('hashchange', handleRoute);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('resize', debounce(() => canvasApp?.resize?.(), 200));

  await syncStatus(false);
  handleRoute();

  pollTimer = setInterval(() => {
    if (!document.hidden) syncStatus(false);
  }, POLL_MS);

  try {
    await fridayApi.checkHealth();
  } catch {
    showToast('Gateway health falhou — verifica deploy', 'warn');
  }
}

init();

export { syncStatus };
