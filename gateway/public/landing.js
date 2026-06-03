(function () {
  const TOKEN_KEY = 'openclaw_office_token';
  const POLL_MS = 60_000;

  const FALLBACK = {
    orchestrator: { label: 'ocioso', metric: 'Portfólio estável · coordenação no Telegram' },
    macofel: { label: 'trabalhando', metric: '21.799 imagens pendentes de sync' },
    heimdall: { label: 'trabalhando', metric: '1 issue aberta · deploys monitorizados' },
    'vp-pecas': { label: 'ocioso', metric: 'Online (~77ms) · vp-pecas.vercel.app' },
  };

  const $ = (id) => document.getElementById(id);

  function getToken() {
    const input = $('landing-token');
    return (
      (input && input.value.trim()) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      ''
    ).trim();
  }

  function saveToken() {
    const t = $('landing-token')?.value.trim() || '';
    if (t) {
      sessionStorage.setItem(TOKEN_KEY, t);
      $('landing-token-hint').textContent = 'Token activo — a actualizar métricas…';
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      $('landing-token-hint').textContent =
        'Sem token: métricas estáticas. O mesmo valor funciona no /office.';
    }
    fetchAgentStatus();
  }

  function setGatewayUi(ok, suffix) {
    const ids = [
      ['nav-status-dot', ok],
      ['hero-status-dot', ok],
      ['footer-status-dot', ok],
    ];
    ids.forEach(([id, isOk]) => {
      const el = $(id);
      if (el) el.className = 'status-dot' + (isOk ? ' ok' : ' err');
    });

    const navText = $('nav-gateway-status-text');
    const heroText = $('hero-ops-text');
    const footerText = $('gateway-status-text');

    if (navText) navText.textContent = ok ? 'Gateway online' : 'Gateway offline';
    if (heroText) {
      heroText.textContent = ok
        ? 'Sistema operacional · ecossistema disponível' + (suffix || '')
        : 'Gateway temporariamente indisponível';
    }
    if (footerText) {
      footerText.textContent = ok
        ? 'Gateway Vercel: online' + (suffix || '')
        : 'Gateway Vercel: offline';
    }
  }

  function checkGatewayHealth() {
    return fetch('/api/health', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        const at =
          data && data.at
            ? ' · ' + new Date(data.at).toLocaleTimeString('pt-PT')
            : '';
        setGatewayUi(true, at);
      })
      .catch(() => setGatewayUi(false));
  }

  function applyAgent(agent) {
    const id = agent.id;
    const pill = $('pill-' + id);
    const metric = $('metric-' + id);
    if (pill) {
      pill.textContent = agent.stateLabel || agent.state || '—';
      pill.className = 'badge-pill state-' + (agent.state || 'idle');
      if (agent.state === 'error') pill.classList.add('err');
      else if (agent.state === 'idle') pill.classList.add('ok');
    }
    if (metric) {
      metric.textContent = agent.detail || '—';
      metric.className = 'agent-metric mono state-' + (agent.state || '');
      if (agent.state === 'error') metric.classList.add('err');
    }
  }

  function applyFallback() {
    Object.entries(FALLBACK).forEach(([id, fb]) => {
      applyAgent({
        id,
        state: id === 'macofel' || id === 'heimdall' ? 'working' : 'idle',
        stateLabel: fb.label,
        detail: fb.metric,
      });
    });
  }

  function fetchAgentStatus() {
    const token = getToken();
    if (!token) {
      applyFallback();
      return Promise.resolve();
    }

    document.querySelectorAll('.agent-metric').forEach((el) => {
      el.classList.add('loading');
      el.textContent = 'A actualizar…';
    });

    return fetch('/openclaw/office/status', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      cache: 'no-store',
    })
      .then((r) => r.json().then((body) => ({ ok: r.ok, status: r.status, body })))
      .then(({ ok, status, body }) => {
        if (status === 401) {
          $('landing-token-hint').textContent = 'Token inválido — verifica OPENCLAW_AUTOMATION_TOKEN.';
          applyFallback();
          return;
        }
        if (!ok || !body.agents) {
          applyFallback();
          return;
        }
        const active = body.agents.filter((a) => a.state !== 'idle').length;
        const hero = $('hero-ops-text');
        if (hero && $('hero-status-dot')?.classList.contains('ok')) {
          hero.textContent =
            'Sistema operacional · ' +
            body.agents.length +
            ' agente(s) · ' +
            active +
            ' activo(s)';
        }
        body.agents.forEach(applyAgent);
      })
      .catch(() => applyFallback());
  }

  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('visible');
              obs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -48px 0px' }
      );
      els.forEach((el) => obs.observe(el));
    } else {
      els.forEach((el) => el.classList.add('visible'));
    }
    const hero = document.querySelector('.hero');
    if (hero) hero.classList.add('visible');
  }

  function initToken() {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    const input = $('landing-token');
    if (saved && input) input.value = saved;
    $('landing-token-save')?.addEventListener('click', saveToken);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveToken();
    });
  }

  function tick() {
    checkGatewayHealth();
    fetchAgentStatus();
  }

  function init() {
    initToken();
    initReveal();
    tick();
    setInterval(tick, POLL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
