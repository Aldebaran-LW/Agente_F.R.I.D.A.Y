import { fetchMacofelStatus } from './macofel.mjs';
import { fetchGithubStatus } from './github.mjs';
import { fetchDeployHealth } from './deploy.mjs';

/** @typedef {'idle' | 'thinking' | 'working' | 'error'} AgentState */

const STATE_LABELS = {
  idle: 'ocioso',
  thinking: 'pensando',
  working: 'trabalhando',
  error: 'erro',
};

/**
 * @param {string} id
 * @param {string} name
 * @param {string} role
 * @param {AgentState} state
 * @param {string} detail
 * @param {Record<string, unknown>} [meta]
 */
function agent(id, name, role, state, detail, meta = {}) {
  return {
    id,
    name,
    role,
    state,
    stateLabel: STATE_LABELS[state],
    detail,
    ...meta,
  };
}

function macofelAgent(data) {
  if (!data?.ok) {
    return agent('macofel', 'Macofel', 'Catálogo', 'error', data?.error || 'indisponível');
  }
  const pending = Number(data.pending_review ?? 0);
  const imgPending = Number(data.image_sync_pending ?? 0);
  if (pending > 0 || imgPending > 0) {
    const parts = [];
    if (pending > 0) parts.push(`${pending} revisão`);
    if (imgPending > 0) parts.push(`${imgPending} imagens`);
    return agent('macofel', 'Macofel', 'Catálogo', 'working', parts.join(' · '), {
      pending_review: pending,
      image_sync_pending: imgPending,
      source: data.source,
    });
  }
  return agent('macofel', 'Macofel', 'Catálogo', 'idle', 'catálogo em dia', {
    source: data.source,
    total: data.total,
  });
}

function vpPecasAgent(deploy) {
  const site = deploy?.sites?.find((s) => s.site === 'vp-pecas');
  if (!site) {
    return agent('vp-pecas', 'VP-Peças', 'Usinagem', 'thinking', 'URL não configurada');
  }
  if (!site.ok) {
    return agent('vp-pecas', 'VP-Peças', 'Usinagem', 'error', site.error || `HTTP ${site.status}`, {
      url: site.url,
    });
  }
  if (site.ms && site.ms > 4000) {
    return agent('vp-pecas', 'VP-Peças', 'Usinagem', 'thinking', `lento (${site.ms}ms)`, {
      url: site.url,
      ms: site.ms,
    });
  }
  return agent('vp-pecas', 'VP-Peças', 'Usinagem', 'idle', `online (${site.ms ?? '?'}ms)`, {
    url: site.url,
    status: site.status,
  });
}

function heimdallAgent(github, deploy) {
  const repos = github?.repos ?? [];
  const repoMissing = repos.filter((r) => r.error === '404');
  const repoErrors = repos.filter((r) => r.error && r.error !== '404');
  if (repoErrors.length > 0) {
    return agent('heimdall', 'Heimdall', 'Observador', 'error', `${repoErrors.length} repo(s) inacessível`, {
      repos: github.repos,
    });
  }
  if (repoMissing.length > 0) {
    return agent(
      'heimdall',
      'Heimdall',
      'Observador',
      'thinking',
      `${repoMissing.length} repo(s) nao encontrado(s) no GitHub`,
      { repos: github.repos }
    );
  }
  const issues = (github?.repos ?? []).reduce((n, r) => n + (r.open_issues ?? 0), 0);
  const deployBad = (deploy?.sites ?? []).filter((s) => !s.ok).length;
  if (deployBad > 0) {
    return agent('heimdall', 'Heimdall', 'Observador', 'working', `${deployBad} site(s) em falha · ${issues} issues`, {
      issues,
    });
  }
  if (issues > 0) {
    return agent('heimdall', 'Heimdall', 'Observador', 'working', `${issues} issue(s) aberta(s)`, { issues });
  }
  return agent('heimdall', 'Heimdall', 'Observador', 'idle', 'repos e deploys OK', {
    owner: github?.owner,
  });
}

function orchestratorAgent(macofel, github, deploy) {
  const subs = [macofelAgent(macofel), vpPecasAgent(deploy), heimdallAgent(github, deploy)];
  if (subs.some((a) => a.state === 'error')) {
    return agent('orchestrator', 'Jarvis', 'Cérebro', 'error', 'incidente no portfólio');
  }
  if (subs.some((a) => a.state === 'working')) {
    return agent('orchestrator', 'Jarvis', 'Orquestrador', 'working', 'a coordenar tarefas');
  }
  if (subs.some((a) => a.state === 'thinking')) {
    return agent('orchestrator', 'Jarvis', 'Orquestrador', 'thinking', 'a monitorizar');
  }
  return agent('orchestrator', 'Jarvis', 'Orquestrador', 'idle', 'portfólio estável');
}

export async function fetchOfficeSnapshot() {
  const [macofel, github, deploy] = await Promise.all([
    fetchMacofelStatus(),
    fetchGithubStatus(),
    fetchDeployHealth(),
  ]);

  const agents = [
    orchestratorAgent(macofel, github, deploy),
    macofelAgent(macofel),
    vpPecasAgent(deploy),
    heimdallAgent(github, deploy),
  ];

  const hasError = agents.some((a) => a.state === 'error');
  const hasWork = agents.some((a) => a.state === 'working');

  return {
    ok: !hasError,
    busy: hasWork,
    agents,
    sources: {
      macofel: macofel?.ok ?? false,
      github: github?.ok ?? false,
      deploy: deploy?.ok ?? false,
    },
    at: new Date().toISOString(),
  };
}
