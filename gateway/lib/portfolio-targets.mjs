/** Portfolio targets monitored by heimdall / Jarvis. Override: GITHUB_REPOS=Macofel_2.0,Agente_OpenClaw */

const DEFAULT_GITHUB_REPOS = ['Macofel_2.0', 'Agente_OpenClaw', 'LWDigitalForge_Texte'];

function parseGithubReposEnv() {
  const raw = process.env.GITHUB_REPOS?.trim();
  if (!raw) return null;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : null;
}

export const GITHUB_REPOS = parseGithubReposEnv() || DEFAULT_GITHUB_REPOS;

export const DEPLOY_SITES = [
  { key: 'macofel', env: 'MACOFEL_URL', default: 'https://macofel-2-0.vercel.app' },
  { key: 'vp-pecas', env: 'VP_PECAS_URL', default: 'https://vp-pecas.vercel.app' },
  { key: 'portal', env: 'LWDIGITALFORGE_URL', default: 'https://www.lwdigitalforge.com' },
];

export const VERCEL_PROJECT_FILTER = /macofel|vp-pecas|vp-precision|texte|lwdigital|digital.?forge/i;
