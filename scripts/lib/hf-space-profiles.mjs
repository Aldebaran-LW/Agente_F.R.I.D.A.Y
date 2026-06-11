/** Perfis HF Space — fonte para generate + assemble + orchestrate hints. */

export const HF_SPACE_PROFILES = {
  core: {
    title: 'OpenClaw Core',
    emoji: '🧠',
    repo: 'Aldebaran-LW/openclaw-core',
    urlEnv: 'HF_OPENCLAW_CORE_URL',
    spaceProfile: 'core',
    agents: ['heimdall', 'vp-pecas', 'veldora', 'rimuru', 'dedalo', 'icaro'],
  },
  innovation: {
    title: 'OpenClaw Innovation',
    emoji: '💡',
    repo: 'Aldebaran-LW/openclaw-innovation',
    urlEnv: 'HF_OPENCLAW_INNOVATION_URL',
    spaceProfile: 'innovation',
    agents: ['sophia', 'yato', 'senku', 'gideon', 'hefestos', 'rebeca'],
  },
  macofel: {
    title: 'Macofel Agent',
    emoji: '🛒',
    repo: 'Aldebaran-LW/macofel-agent',
    urlEnv: 'HF_MACOFEL_SPACE_URL',
    spaceProfile: 'macofel',
    agents: ['macofel'],
  },
  unified: {
    title: 'F.R.I.D.A.Y. Legacy',
    emoji: '🤖',
    repo: 'Aldebaran-LW/friday-prod',
    urlEnv: 'HF_FRIDAY_PROD_URL',
    spaceProfile: 'unified',
    agents: 'all',
  },
};

export function profileAgentSet(profileId) {
  const p = HF_SPACE_PROFILES[profileId];
  if (!p) return null;
  if (p.agents === 'all') return null;
  return new Set(p.agents);
}

export function agentProfile(agentId) {
  const id = String(agentId || '').toLowerCase();
  for (const [pid, p] of Object.entries(HF_SPACE_PROFILES)) {
    if (pid === 'unified') continue;
    if (p.agents !== 'all' && p.agents.includes(id)) return pid;
  }
  if (id === 'pipeline') return 'innovation';
  if (['byte', 'ops'].includes(id)) return 'core';
  if (['pixel', 'lala'].includes(id)) return id === 'lala' ? 'macofel' : 'core';
  if (['odin', 'athena'].includes(id)) return 'core';
  return null;
}
