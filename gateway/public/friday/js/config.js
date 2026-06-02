/** Constantes e metadados — F.R.I.D.A.Y. OpenClaw */

export const TOKEN_KEY = 'openclaw_office_token';
export const PREFS_KEY = 'friday_prefs';
export const CACHE_KEY = 'friday_status_cache';
export const POLL_MS = 30_000;

/** Mapeia IDs da API /openclaw/office/status → chaves internas */
export const API_ID_MAP = {
  orchestrator: 'jarvis',
  macofel: 'macofel',
  heimdall: 'heimdall',
  'vp-pecas': 'vppecas',
};

export const MOCK_AGENTS = {
  jarvis: {
    id: 'jarvis',
    apiId: 'orchestrator',
    name: 'Jarvis',
    role: 'Orquestrador & Telegram',
    desc: 'Núcleo do ecossistema. Avalia comandos, valida permissões e distribui fluxos.',
    model: 'nvidia/nemotron-3',
    color: '#3b82f6',
    icon: 'cpu',
    emoji: '🤖',
    actions: ['Analisando intenção 🧠', 'Aguardando aprovação ⏳', 'Roteando pedido 🔀', 'Telegram 📱'],
    status: 'online',
    detail: 'Portfólio estável',
    state: 'idle',
  },
  macofel: {
    id: 'macofel',
    apiId: 'macofel',
    name: 'Macofel',
    role: 'Gestão E-commerce',
    desc: 'Catálogo, MongoDB e descrições de produtos via visão computacional.',
    model: 'deepseek-v4-flash',
    color: '#10b981',
    icon: 'shopping-cart',
    emoji: '🛒',
    actions: ['Extraindo dados 🌐', 'Sync MongoDB 💾', 'Descrições ✍️', 'Imagens 🖼️'],
    status: 'online',
    detail: 'Catálogo em dia',
    state: 'working',
  },
  heimdall: {
    id: 'heimdall',
    apiId: 'heimdall',
    name: 'Heimdall',
    role: 'DevOps & Git',
    desc: 'Deploys Vercel, GitHub e rotinas Cron.',
    model: 'poolside/laguna',
    color: '#8b5cf6',
    icon: 'git-merge',
    emoji: '👁️',
    actions: ['Gateway 🛡️', 'Cron Job ⏱️', 'GitHub 🐙', 'Logs 📊'],
    status: 'online',
    detail: 'Repos OK',
    state: 'working',
  },
  vppecas: {
    id: 'vppecas',
    apiId: 'vp-pecas',
    name: 'VP-Peças',
    role: 'Monitorização CNC',
    desc: 'Sensores industriais, alertas e relatórios de chão de fábrica.',
    model: 'minimax-m2.5',
    color: '#f59e0b',
    icon: 'wrench',
    emoji: '⚙️',
    actions: ['Sensores CNC ⚙️', 'OEE 📈', 'Manutenção ⚠️', 'Turno 👷'],
    status: 'online',
    detail: 'Online',
    state: 'idle',
  },
};

export function baseUrl() {
  return window.location.origin.replace(/\/$/, '');
}

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function savePrefs(partial) {
  const next = { ...loadPrefs(), ...partial };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}
