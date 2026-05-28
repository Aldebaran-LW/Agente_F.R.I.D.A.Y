import manifest from '../skills/manifest.json' with { type: 'json' };

const skills = manifest.skills ?? {};

export function getSkill(name) {
  return skills[name] ?? null;
}

export function skillRequiresApproval(name) {
  return Boolean(getSkill(name)?.requiresApproval);
}

export function skillTimeoutMs(name) {
  const ms = getSkill(name)?.timeoutMs;
  return typeof ms === 'number' && ms > 0 ? ms : 25000;
}

export function assertSkillAllowed(name, { write = false } = {}) {
  const skill = getSkill(name);
  if (!skill) {
    return { ok: false, error: `skill desconhecida: ${name}` };
  }
  if (write && skill.mode === 'read') {
    return { ok: false, error: `skill ${name} e somente leitura` };
  }
  return { ok: true, skill };
}

export function listSkills() {
  return Object.entries(skills).map(([name, meta]) => ({
    name,
    agent: meta.agent,
    mode: meta.mode,
    requiresApproval: meta.requiresApproval,
  }));
}
