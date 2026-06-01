/**
 * Regras Heimdall (watch-agents.json) — sempre no bundle Vercel.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const gatewayRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let watchCache = null;

function loadWatchConfig() {
  if (watchCache) return watchCache;
  const p = resolve(gatewayRoot, 'agents', 'heimdall', 'watch-agents.json');
  watchCache = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { agents: [] };
  return watchCache;
}

function agentRule(agentId) {
  return (loadWatchConfig().agents || []).find((a) => a.id === agentId);
}

export function checkAgentContext(run) {
  if (!run?.route_agent) return { ok: true, reason: 'sem run' };
  const rule = agentRule(run.route_agent);
  if (!rule) return { ok: true, reason: 'agente sem regras' };
  const skill = run.route_skill;
  if (!skill) return { ok: true };
  if (rule.forbidden_skills?.includes(skill)) {
    return {
      ok: false,
      violation: true,
      reason: `skill proibida ${skill} para ${run.route_agent}`,
    };
  }
  if (rule.allowed_skills?.length && !rule.allowed_skills.includes(skill)) {
    return {
      ok: false,
      violation: true,
      reason: `skill ${skill} fora do contexto de ${run.route_agent}`,
    };
  }
  return { ok: true, skill };
}
