/** Alvos do portfólio Aldebaran-LW monitorados pelo agente heimdall / Jarvis. */

export const GITHUB_REPOS = [
  'Macofel_2.0',
  'VP-Pecas',
  'vp-precision-studio',
];

export const DEPLOY_SITES = [
  { key: 'macofel', env: 'MACOFEL_URL', default: 'https://macofel-2-0.vercel.app' },
  { key: 'vp-pecas', env: 'VP_PECAS_URL', default: 'https://vp-pecas.vercel.app' },
  { key: 'portal', env: 'LWDIGITALFORGE_URL', default: 'https://www.lwdigitalforge.com' },
];

export const VERCEL_PROJECT_FILTER = /macofel|vp-pecas|vp-precision|texte|lwdigital|digital.?forge/i;
