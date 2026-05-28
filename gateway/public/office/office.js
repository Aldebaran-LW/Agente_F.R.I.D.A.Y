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

function init() {
  const saved = sessionStorage.getItem(TOKEN_KEY);
  if (saved) $('token').value = saved;

  $('save-token').addEventListener('click', () => {
    saveToken();
    fetchOffice();
  });
  $('refresh').addEventListener('click', fetchOffice);

  tickClock();
  setInterval(tickClock, 1000);
  setInterval(fetchOffice, POLL_MS);

  fetchOffice();
}

init();
