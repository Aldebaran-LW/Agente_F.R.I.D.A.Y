const TOKEN_KEY = 'openclaw_office_token';
const POLL_MS = 30_000;

const $ = (id) => document.getElementById(id);

function baseUrl() {
  return window.location.origin.replace(/\/$/, '');
}

function getToken() {
  return ($('token').value || sessionStorage.getItem(TOKEN_KEY) || '').trim();
}

function saveToken() {
  const t = $('token').value.trim();
  if (t) sessionStorage.setItem(TOKEN_KEY, t);
  $('status-line').textContent = t ? 'Token guardado nesta sessão.' : 'Token removido.';
}

function applyAgent(a) {
  const sprite = $(`sprite-${a.id}`);
  const bubble = $(`bubble-${a.id}`);
  if (!sprite || !bubble) return;

  sprite.className = `sprite state-${a.state}`;
  bubble.className = `bubble visible state-${a.state}`;
  bubble.textContent = `${a.stateLabel}: ${a.detail}`;
}

function setStatus(msg, isErr = false) {
  const el = $('status-line');
  el.textContent = msg;
  el.classList.toggle('err', isErr);
}

async function fetchOffice() {
  const token = getToken();
  if (!token) {
    setStatus('Introduz o token (mesmo valor que OPENCLAW_AUTOMATION_TOKEN) e clica Guardar.', true);
    return;
  }

  setStatus('A atualizar…');
  const url = `${baseUrl()}/openclaw/office/status`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    setStatus('Token inválido.', true);
    return;
  }
  if (!res.ok) {
    setStatus(body.error || `Erro HTTP ${res.status}`, true);
    return;
  }

  for (const a of body.agents || []) applyAgent(a);

  const labels = (body.agents || []).map((a) => a.stateLabel).join(' · ');
  setStatus(
    `OK · ${new Date(body.at).toLocaleTimeString('pt-PT')} · ${labels}`,
    !body.ok
  );
}

function tickClock() {
  $('clock').textContent = new Date().toLocaleTimeString('pt-PT');
}

function readTokenFromHash() {
  const raw = window.location.hash.replace(/^#/, '').trim();
  if (!raw) return;
  let t = '';
  if (raw.startsWith('token=')) {
    t = raw.slice('token='.length);
  } else {
    try {
      const params = new URLSearchParams(raw);
      t = params.get('token') || '';
    } catch {
      t = '';
    }
  }
  t = decodeURIComponent(t).trim();
  if (!t) return;
  sessionStorage.setItem(TOKEN_KEY, t);
  $('token').value = t;
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

function formatInnovation(data) {
  if (!data.ok) return data.error || 'Sem dados';
  const lines = [];
  if (data.predictions?.length) {
    lines.push('Predições (≥70):');
    for (const p of data.predictions) {
      lines.push(`  · ${p.topico || p.file} — score ${p.score} → ${p.recomendacao || '?'}`);
    }
  } else {
    lines.push('Predições ≥70: nenhuma no período.');
  }
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
  const token = getToken();
  const el = $('innovation-body');
  if (!token) {
    el.textContent = 'Token necessário.';
    return;
  }
  el.textContent = 'A carregar…';
  const url = `${baseUrl()}/openclaw/innovation/status?days=7`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    el.textContent = body.error || `HTTP ${res.status}`;
    return;
  }
  el.textContent = formatInnovation(body);
}

function init() {
  readTokenFromHash();
  const saved = sessionStorage.getItem(TOKEN_KEY);
  if (saved) $('token').value = saved;

  $('save-token').addEventListener('click', () => {
    saveToken();
    fetchOffice();
    fetchInnovation();
  });
  $('refresh').addEventListener('click', () => {
    fetchOffice();
    fetchInnovation();
  });
  if ($('refresh-innovation')) {
    $('refresh-innovation').addEventListener('click', fetchInnovation);
  }

  tickClock();
  setInterval(tickClock, 1000);
  setInterval(fetchOffice, POLL_MS);

  fetchOffice();
  fetchInnovation();
}

init();
