/**
 * Veldora — guardião no gateway (orchestrate / encaminhamento HF).
 * Allowlist: agents/veldora/sources-allowlist.txt
 */
import {
  isAllowedSource,
  validateRequest,
  validateTaskUrls,
  filterAllowedUrls,
  extractUrlsFromText,
  RESEARCH_GUARD_AGENTS,
} from '../../agents/veldora/validate-sources.mjs';
import { isHubEnabled, persistLearning } from './hub-store.mjs';

export {
  isAllowedSource,
  validateRequest,
  validateTaskUrls,
  filterAllowedUrls,
  extractUrlsFromText,
  RESEARCH_GUARD_AGENTS,
};

/**
 * Compatível com proposta validateAgentRequest(agentId, targetUrl, task).
 */
export function validateAgentRequest(agentId, targetUrl, task = null) {
  return validateRequest(agentId, targetUrl, task ? { taskPreview: String(task).slice(0, 200) } : {});
}

/**
 * Bloqueia encaminhamento se o pedido contiver URL não autorizada (Yato, Gideon, …).
 */
export function guardOrchestrateForward(agentId, task) {
  return validateTaskUrls(agentId, task);
}

/**
 * Registo no Supabase Hub (agent_learnings), metadata.type = security_audit.
 */
export async function logSecurityEvent(event) {
  if (!isHubEnabled()) return null;
  try {
    const content =
      event.reason ||
      `Acesso autorizado: ${event.agent} → ${event.targetUrl || '(sem URL)'}`;
    return await persistLearning({
      agentId: 'veldora',
      source: 'veldora-guard',
      content: String(content).slice(0, 8000),
      metadata: {
        type: 'security_audit',
        ...event,
      },
    });
  } catch (e) {
    console.warn('[Veldora] Falha ao logar evento:', e.message);
    return null;
  }
}
