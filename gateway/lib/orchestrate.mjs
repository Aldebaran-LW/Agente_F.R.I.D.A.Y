/**
 * Roteamento Friday (Vercel) -> AWS EC2 | HF Spaces
 * Nao executa tarefas longas; apenas encaminha com timeout curto.
 */

const VERCEL_TIMEOUT_MS = Number(process.env.ORCHESTRATE_TIMEOUT_MS || 8000);

/** @type {Record<string, { residence: string, label: string }>} */
export const AGENT_RESIDENCE = {
  orchestrator: { residence: 'aws', label: 'Jarvis (EC2)' },
  jarvis: { residence: 'aws', label: 'Jarvis (EC2)' },
  macofel: { residence: 'aws', label: 'Macofel (EC2/API)' },
  ops: { residence: 'aws', label: 'Ops (EC2 cron)' },
  'vp-pecas': { residence: 'aws', label: 'VP-Pecas (EC2)' },
  sophia: { residence: 'hf', label: 'Sophia (HF Space)' },
  rebeca: { residence: 'hf', label: 'Rebeca (HF Space)' },
  senku: { residence: 'hf', label: 'Senku (HF Space)' },
  hefestos: { residence: 'hf', label: 'Hefestos (HF Space)' },
  icaro: { residence: 'aws', label: 'Ícaro (EC2 scripts)' },
  athena: { residence: 'aws', label: 'Athena (EC2 + gateway)' },
  dedalo: { residence: 'hf', label: 'Dédalo (HF Dataset)' },
};

function envUrl(key) {
  const v = process.env[key]?.trim();
  return v || null;
}

/**
 * @param {string} agentId
 * @returns {{ target: 'aws'|'hf'|'vercel', endpoint: string|null, mode: string } | null}
 */
export function resolveRoute(agentId) {
  const id = String(agentId || '').toLowerCase();
  const meta = AGENT_RESIDENCE[id];
  if (!meta) return null;

  if (meta.residence === 'aws' || id === 'jarvis' || id === 'orchestrator') {
    return {
      target: 'aws',
      endpoint: envUrl('JARVIS_EC2_WEBHOOK_URL') || envUrl('OPENCLAW_EC2_ORCHESTRATE_URL'),
      mode: 'ec2_webhook',
      agent: id === 'jarvis' ? 'orchestrator' : id,
    };
  }

  if (meta.residence === 'hf') {
    const base = envUrl('HF_FRIDAY_PROD_URL') || envUrl('HF_INNOVATION_SPACE_URL');
    const perAgent = envUrl(`HF_${id.toUpperCase().replace(/-/g, '_')}_SPACE_URL`);
    const endpoint = perAgent || (base ? `${base.replace(/\/$/, '')}/run/${id}` : null);
    return {
      target: 'hf',
      endpoint,
      mode: perAgent ? 'hf_dedicated_space' : 'hf_shared_space',
      agent: id,
    };
  }

  return { target: 'vercel', endpoint: null, mode: 'gateway_only', agent: id };
}

/**
 * @param {string} agentId
 * @param {string} task
 * @param {{ async?: boolean }} [opts]
 */
export async function forwardTask(agentId, task, opts = {}) {
  const route = resolveRoute(agentId);
  if (!route) {
    return { ok: false, status: 404, error: 'agent not found', agent: agentId };
  }

  if (!route.endpoint) {
    return {
      ok: false,
      status: 503,
      error: 'endpoint not configured',
      route,
      hint: route.target === 'aws'
        ? 'Set JARVIS_EC2_WEBHOOK_URL or OPENCLAW_EC2_ORCHESTRATE_URL on Vercel'
        : 'Set HF_FRIDAY_PROD_URL or HF_<AGENT>_SPACE_URL on Vercel',
    };
  }

  const internalToken = process.env.OPENCLAW_INTERNAL_TOKEN?.trim()
    || process.env.OPENCLAW_AUTOMATION_TOKEN?.trim();
  const hfToken = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_HUB_TOKEN?.trim();

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (route.target === 'hf' && hfToken) {
    headers.Authorization = `Bearer ${hfToken}`;
  } else if (internalToken) {
    headers.Authorization = `Bearer ${internalToken}`;
  }

  const body = JSON.stringify({
    agent: route.agent,
    task: String(task).slice(0, 8000),
    source: 'gateway-orchestrate',
    async: Boolean(opts.async),
  });

  try {
    const res = await fetch(route.endpoint, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(VERCEL_TIMEOUT_MS),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    return {
      ok: res.ok,
      status: res.status,
      route,
      data,
    };
  } catch (e) {
    const timedOut = e.name === 'TimeoutError' || String(e.message).includes('timeout');
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      error: timedOut ? 'upstream timeout (use async or EC2 direct)' : String(e.message),
      route,
    };
  }
}

export function listRoutes() {
  return Object.entries(AGENT_RESIDENCE).map(([id, meta]) => ({
    id,
    ...meta,
    route: resolveRoute(id),
  }));
}
