/**
 * Camada HTTP — gateway Vercel (mesma origem em produção).
 */
import {
  API_ID_MAP,
  CACHE_KEY,
  MOCK_AGENTS,
  TOKEN_KEY,
  baseUrl,
} from './config.js';

function cloneMock() {
  return JSON.parse(JSON.stringify(MOCK_AGENTS));
}

function applyApiAgent(target, apiAgent) {
  if (!target || !apiAgent) return;
  target.status = apiAgent.state === 'error' ? 'offline' : 'online';
  target.state = apiAgent.state || 'idle';
  target.detail = apiAgent.detail || target.detail;
  if (apiAgent.stateLabel) target.stateLabel = apiAgent.stateLabel;
  if (apiAgent.role) target.role = apiAgent.role;
  if (apiAgent.name) target.name = apiAgent.name;
}

export class FridayAPI {
  constructor() {
    this.lastMeta = { connected: false, at: null, sources: null };
    this.lastHub = { items: [], error: null };
  }

  getToken() {
    return (
      sessionStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem('OPENCLAW_AUTOMATION_TOKEN') ||
      ''
    ).trim();
  }

  setToken(token) {
    const t = (token || '').trim();
    if (t) {
      sessionStorage.setItem(TOKEN_KEY, t);
      sessionStorage.setItem('OPENCLAW_AUTOMATION_TOKEN', t);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('OPENCLAW_AUTOMATION_TOKEN');
    }
  }

  readTokenFromHash() {
    const raw = window.location.hash.replace(/^#/, '').trim();
    if (!raw.startsWith('token=')) return false;
    const t = decodeURIComponent(raw.slice('token='.length)).trim();
    if (!t) return false;
    this.setToken(t);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  }

  authHeaders() {
    const token = this.getToken();
    if (!token) return null;
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  }

  async checkHealth() {
    const res = await fetch(`${baseUrl()}/api/health`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`health ${res.status}`);
    return res.json();
  }

  mapOfficeToAgents(body) {
    const agents = cloneMock();
    for (const apiAgent of body.agents || []) {
      const key = API_ID_MAP[apiAgent.id];
      if (key && agents[key]) applyApiAgent(agents[key], apiAgent);
    }
    this.lastMeta = {
      connected: true,
      at: body.at || new Date().toISOString(),
      sources: body.sources || null,
      ok: Boolean(body.ok),
    };
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ at: this.lastMeta.at, agents, sources: body.sources }),
      );
    } catch {
      /* quota */
    }
    return agents;
  }

  loadCachedAgents() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { agents, at } = JSON.parse(raw);
      if (!agents) return null;
      this.lastMeta = { connected: false, at, sources: null, ok: null, cached: true };
      return agents;
    } catch {
      return null;
    }
  }

  /**
   * @returns {{ agents: Record<string, object>, mode: 'live'|'cache'|'mock', error?: string }}
   */
  async fetchStatus() {
    const headers = this.authHeaders();
    if (!headers) {
      return { agents: cloneMock(), mode: 'mock', error: 'no_token' };
    }

    try {
      const res = await fetch(`${baseUrl()}/openclaw/office/status`, {
        headers,
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 401) {
        return { agents: cloneMock(), mode: 'mock', error: 'unauthorized' };
      }
      if (!res.ok || !body.agents) {
        const cached = this.loadCachedAgents();
        if (cached) return { agents: cached, mode: 'cache', error: body.error || `http_${res.status}` };
        return { agents: cloneMock(), mode: 'mock', error: body.error || `http_${res.status}` };
      }

      return { agents: this.mapOfficeToAgents(body), mode: 'live' };
    } catch (e) {
      const cached = this.loadCachedAgents();
      if (cached) return { agents: cached, mode: 'cache', error: e.message };
      return { agents: cloneMock(), mode: 'mock', error: e.message };
    }
  }

  async fetchHubRecent(limit = 20) {
    const headers = this.authHeaders();
    if (!headers) {
      this.lastHub = { items: [], error: 'no_token' };
      return { ok: false, error: 'no_token', items: [] };
    }

    try {
      const res = await fetch(
        `${baseUrl()}/openclaw/hub/recent?limit=${limit}&snapshots=0`,
        { headers, cache: 'no-store' },
      );
      const body = await res.json().catch(() => ({}));

      if (res.status === 503 && body.error === 'supabase_not_configured') {
        this.lastHub = { items: [], error: 'supabase_not_configured' };
        return { ok: false, error: 'supabase_not_configured', items: [] };
      }
      if (!res.ok) {
        this.lastHub = { items: [], error: body.error || `http_${res.status}` };
        return { ok: false, error: this.lastHub.error, items: [] };
      }

      const { parseHubItems } = await import('./hub.js');
      const items = parseHubItems(body);
      this.lastHub = { items, error: null, raw: body };
      return { ok: true, data: body, items };
    } catch (e) {
      this.lastHub = { items: [], error: e.message };
      return { ok: false, error: e.message, items: [] };
    }
  }

  async postJarvis(message, approved = false) {
    const headers = this.authHeaders();
    if (!headers) return { ok: false, error: 'no_token' };

    try {
      const res = await fetch(`${baseUrl()}/jarvis`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, approved }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return { ok: false, error: 'unauthorized', status: 401 };
      return { ok: res.ok && body.ok !== false, status: res.status, body };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async fetchOrchestrateRoutes() {
    const headers = this.authHeaders();
    if (!headers) return { ok: false, agents: [], error: 'no_token' };

    try {
      const res = await fetch(`${baseUrl()}/openclaw/orchestrate`, { headers, cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, agents: [], error: body.error || `http_${res.status}` };
      return { ok: true, agents: body.agents || [], meta: body };
    } catch (e) {
      return { ok: false, agents: [], error: e.message };
    }
  }

  async postOrchestrate(agent, task) {
    const headers = this.authHeaders();
    if (!headers) return { ok: false, error: 'no_token' };

    try {
      const res = await fetch(`${baseUrl()}/openclaw/orchestrate`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, task, message: task }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return { ok: false, error: 'unauthorized', status: 401 };
      return { ok: res.ok && body.ok !== false, status: res.status, body };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

export const fridayApi = new FridayAPI();
