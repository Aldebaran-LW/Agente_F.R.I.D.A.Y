import { fridayApi } from './api.js';
import { showToast } from './utils.js';

const HISTORY_KEY = 'friday_playground_history';
const MAX_HISTORY = 40;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function loadHistory() {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-MAX_HISTORY)));
}

function appendMessage(role, text, meta = {}) {
  const entries = loadHistory();
  entries.push({ role, text, meta, at: new Date().toISOString() });
  saveHistory(entries);
  renderHistory();
}

function renderHistory() {
  const log = document.getElementById('playground-log');
  if (!log) return;
  const entries = loadHistory();
  if (!entries.length) {
    log.innerHTML = '<p class="activity-empty">Envia uma mensagem para começar. Modo Jarvis usa POST /jarvis.</p>';
    return;
  }

  log.innerHTML = entries
    .map((e) => {
      const cls = e.role === 'user' ? 'pg-user' : e.role === 'error' ? 'pg-error' : 'pg-jarvis';
      const meta =
        e.meta?.traceId || e.meta?.delegate
          ? `<span class="mono pg-meta">${escapeHtml(e.meta.traceId || '')} ${e.meta.delegate ? '→ ' + escapeHtml(e.meta.delegate) : ''}</span>`
          : '';
      return `<div class="pg-msg ${cls}">
        <div class="pg-role">${e.role === 'user' ? 'Tu' : e.role === 'error' ? 'Erro' : 'Jarvis'}</div>
        <div class="pg-text">${escapeHtml(e.text).replace(/\n/g, '<br>')}</div>
        ${meta}
      </div>`;
    })
    .join('');
  log.scrollTop = log.scrollHeight;
}

function getMode() {
  return document.querySelector('input[name="pg-mode"]:checked')?.value || 'jarvis';
}

function needsApprovalHint(text) {
  return /aprova|confirmar|sim\b|escrita|sync|deploy|muta/i.test(text);
}

async function populateOrchestrateAgents() {
  const sel = document.getElementById('pg-orchestrate-agent');
  if (!sel) return;
  const res = await fridayApi.fetchOrchestrateRoutes();
  if (!res.ok || !res.agents.length) {
    sel.innerHTML =
      '<option value="orchestrator">orchestrator (fallback)</option><option value="macofel">macofel</option><option value="heimdall">heimdall</option>';
    return;
  }
  sel.innerHTML = res.agents
    .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label || a.id)}</option>`)
    .join('');
}

function toggleModePanels() {
  const mode = getMode();
  document.getElementById('pg-jarvis-options')?.classList.toggle('hidden', mode !== 'jarvis');
  document.getElementById('pg-orchestrate-options')?.classList.toggle('hidden', mode !== 'orchestrate');
}

async function sendMessage() {
  const input = document.getElementById('pg-input');
  const text = input?.value.trim() || '';
  if (!text) return;

  if (!fridayApi.getToken()) {
    showToast('Token necessário — abre o ícone da chave', 'error');
    return;
  }

  const btn = document.getElementById('pg-send');
  btn?.setAttribute('disabled', 'true');

  const mode = getMode();
  appendMessage('user', text, { mode });
  input.value = '';

  try {
    if (mode === 'orchestrate') {
      const confirmed = document.getElementById('pg-orchestrate-confirm')?.checked;
      if (!confirmed) {
        appendMessage('error', 'Marca a confirmação antes de orquestrar (política de segurança).', {});
        return;
      }
      const agent = document.getElementById('pg-orchestrate-agent')?.value || 'orchestrator';
      const res = await fridayApi.postOrchestrate(agent, text);
      if (!res.ok) {
        appendMessage('error', res.error || res.body?.error || `HTTP ${res.status}`, {});
        showToast('Orquestração falhou', 'error');
      } else {
        const summary = [
          res.body?.ok ? 'OK' : 'Falha',
          res.body?.agent && `agente: ${res.body.agent}`,
          res.body?.residence && `residência: ${res.body.residence}`,
          res.body?.mode && `modo: ${res.body.mode}`,
          res.body?.error && `erro: ${res.body.error}`,
          res.body?.data && typeof res.body.data === 'object'
            ? JSON.stringify(res.body.data).slice(0, 400)
            : res.body?.data
              ? String(res.body.data).slice(0, 400)
              : '',
        ]
          .filter(Boolean)
          .join('\n');
        appendMessage('jarvis', summary || 'Tarefa encaminhada.', {
          delegate: res.body?.agent,
        });
        showToast('Tarefa encaminhada', 'ok');
      }
    } else {
      const approved = document.getElementById('pg-jarvis-approved')?.checked;
      const res = await fridayApi.postJarvis(text, approved);
      if (!res.ok) {
        appendMessage('error', res.error || res.body?.error || `HTTP ${res.status}`, {});
        showToast('Jarvis falhou', 'error');
      } else {
        const reply = res.body?.reply || res.body?.telegram?.text || JSON.stringify(res.body).slice(0, 500);
        appendMessage('jarvis', reply, {
          traceId: res.body?.traceId,
          delegate: res.body?.delegate,
          skill: res.body?.skill,
        });
        if (res.body?.approval?.blocked) {
          showToast('Acção bloqueada — responde com "sim" ou marca aprovação', 'warn');
          document.getElementById('pg-jarvis-approved')?.closest('label')?.classList.add('highlight');
        } else {
          showToast('Resposta recebida', 'ok');
        }
      }
    }
  } finally {
    btn?.removeAttribute('disabled');
  }
}

export function initPlayground() {
  renderHistory();
  populateOrchestrateAgents();
  toggleModePanels();

  document.querySelectorAll('input[name="pg-mode"]').forEach((el) => {
    el.addEventListener('change', toggleModePanels);
  });

  document.getElementById('pg-send')?.addEventListener('click', sendMessage);
  document.getElementById('pg-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('pg-clear')?.addEventListener('click', () => {
    sessionStorage.removeItem(HISTORY_KEY);
    renderHistory();
    showToast('Histórico limpo', 'info');
  });

  const input = document.getElementById('pg-input');
  input?.addEventListener('input', () => {
    const hint = document.getElementById('pg-approval-hint');
    if (!hint) return;
    hint.classList.toggle('hidden', !needsApprovalHint(input.value));
  });
}

export function onPlaygroundViewActive() {
  populateOrchestrateAgents();
  renderHistory();
}
