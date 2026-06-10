/**
 * Roteamento Friday (Vercel) -> EC2 minima (Jarvis) | HF Spaces por perfil
 * core | innovation | macofel — ver config/hf-space-profiles.yaml
 */

import { guardOrchestrateForward, logSecurityEvent } from './veldora-guard.mjs';

const VERCEL_TIMEOUT_MS = Number(process.env.ORCHESTRATE_TIMEOUT_MS || 8000);
const HF_SPACE_TIMEOUT_MS = Number(process.env.ORCHESTRATE_INNOVATION_TIMEOUT_MS || 120000);

const HF_PROFILE_ENV = {
  core: 'HF_OPENCLAW_CORE_URL',
  innovation: 'HF_OPENCLAW_INNOVATION_URL',
  macofel: 'HF_MACOFEL_SPACE_URL',
};

const AGENT_HF_PROFILE = {
  macofel: 'macofel',
  lala: 'macofel',
  heimdall: 'core',
  ops: 'core',
  byte: 'core',
  'vp-pecas': 'core',
  pixel: 'core',
  veldora: 'core',
  odin: 'core',
  rimuru: 'core',
  athena: 'core',
  dedalo: 'core',
  icaro: 'core',
  sophia: 'innovation',
  yato: 'innovation',
  senku: 'innovation',
  gideon: 'innovation',
  hefestos: 'innovation',
  rebeca: 'innovation',
  pipeline: 'innovation',
};

/** @type {Record<string, { residence: string, label: string, hfProfile?: string }>} */
export const AGENT_RESIDENCE = {
  orchestrator: { residence: 'aws', label: 'Jarvis (EC2 — Telegram)' },
  jarvis: { residence: 'aws', label: 'Jarvis (EC2 — Telegram)' },
  macofel: { residence: 'hf', hfProfile: 'macofel', label: 'Macofel (HF macofel-agent)' },
  lala: { residence: 'hf', hfProfile: 'macofel', label: 'Macofel (HF macofel-agent)' },
  heimdall: { residence: 'hf', hfProfile: 'core', label: 'Heimdall (HF openclaw-core)' },
  ops: { residence: 'hf', hfProfile: 'core', label: 'Ops (HF openclaw-core)' },
  byte: { residence: 'hf', hfProfile: 'core', label: 'Ops (HF openclaw-core)' },
  'vp-pecas': { residence: 'hf', hfProfile: 'core', label: 'VP-Pecas (HF openclaw-core)' },
  pixel: { residence: 'hf', hfProfile: 'core', label: 'VP-Pecas (HF openclaw-core)' },
  sophia: { residence: 'hf', hfProfile: 'innovation', label: 'Sophia (HF openclaw-innovation)' },
  yato: { residence: 'hf', hfProfile: 'innovation', label: 'Yato (HF openclaw-innovation)' },
  rebeca: { residence: 'hf', hfProfile: 'innovation', label: 'Rebeca (HF openclaw-innovation)' },
  senku: { residence: 'hf', hfProfile: 'innovation', label: 'Senku (HF openclaw-innovation)' },
  gideon: { residence: 'hf', hfProfile: 'innovation', label: 'Gideon (HF openclaw-innovation)' },
  pipeline: { residence: 'hf', hfProfile: 'innovation', label: 'Pipeline (HF openclaw-innovation)' },
  hefestos: { residence: 'hf', hfProfile: 'innovation', label: 'Hefestos (HF openclaw-innovation)' },
  icaro: { residence: 'hf', hfProfile: 'core', label: 'Icaro (HF openclaw-core)' },
  rimuru: { residence: 'hf', hfProfile: 'core', label: 'Rimuru (HF openclaw-core)' },
  athena: { residence: 'hf', hfProfile: 'core', label: 'Athena (HF openclaw-core)' },
  veldora: { residence: 'hf', hfProfile: 'core', label: 'Veldora (HF openclaw-core)' },
  odin: { residence: 'hf', hfProfile: 'core', label: 'Veldora (HF openclaw-core)' },
  dedalo: { residence: 'hf', hfProfile: 'core', label: 'Dedalo (HF openclaw-core)' },
};

function envUrl(key) {
  const v = process.env[key]?.trim();
  return v || null;
}

/** Aliases Forge → agent_id no friday-prod. */
const FORGE_AGENT_ALIAS = {
  jarvis: 'orchestrator',
  friday: 'orchestrator',
  byte: 'heimdall',
  pixel: 'vp-pecas',
  lala: 'macofel',
  odin: 'veldora',
  athena: 'rimuru',
};

/**
 * @param {string} agentId
 * @returns {{ target: 'aws'|'hf'|'vercel', endpoint: string|null, mode: string } | null}
 */
export function resolveRoute(agentId) {
  const raw = String(agentId || '').toLowerCase();
  const id = FORGE_AGENT_ALIAS[raw] || raw;
  const meta = AGENT_RESIDENCE[raw] || AGENT_RESIDENCE[id];
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
    const profile = meta.hfProfile || AGENT_HF_PROFILE[id] || 'core';
    const profileEnv = HF_PROFILE_ENV[profile];
    const base = (profileEnv && envUrl(profileEnv))
      || envUrl('HF_FRIDAY_PROD_URL')
      || envUrl('HF_INNOVATION_SPACE_URL');
    const perAgent = envUrl(`HF_${id.toUpperCase().replace(/-/g, '_')}_SPACE_URL`);
    const path = id === 'pipeline' ? '/run/pipeline' : `/run/${id}`;
    const endpoint = perAgent || (base ? `${base.replace(/\/$/, '')}${path}` : null);
    return {
      target: 'hf',
      endpoint,
      mode: `hf_${profile}`,
      hfProfile: profile,
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

  const guard = guardOrchestrateForward(agentId, task);
  if (!guard.allowed) {
    await logSecurityEvent({
      ...guard,
      source: 'gateway-orchestrate',
      taskPreview: String(task).slice(0, 200),
    });
    return {
      ok: false,
      status: 403,
      error: guard.reason,
      agent: agentId,
      blockedBy: 'veldora',
      veldora: guard,
    };
  }

  if (!route.endpoint) {
    return {
      ok: false,
      status: 503,
      error: 'endpoint not configured',
      route,
      hint: route.target === 'aws'
        ? 'Set JARVIS_EC2_WEBHOOK_URL or OPENCLAW_EC2_ORCHESTRATE_URL on Vercel'
        : 'Set HF_OPENCLAW_CORE_URL, HF_OPENCLAW_INNOVATION_URL, HF_MACOFEL_SPACE_URL on Vercel',
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
    context: opts.context && typeof opts.context === 'object' ? opts.context : undefined,
  });

  const timeoutMs = route.target === 'hf'
    ? HF_SPACE_TIMEOUT_MS
    : VERCEL_TIMEOUT_MS;

  try {
    const res = await fetch(route.endpoint, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
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
