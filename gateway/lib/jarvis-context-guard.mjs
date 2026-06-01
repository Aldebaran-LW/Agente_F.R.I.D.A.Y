/**
 * Valida roteamento Jarvis vs contexto do agente (Heimdall watch-agents.json).
 * Apenas regista — não bloqueia pedidos (Jarvis orquestra).
 */
import { checkAgentContext } from './heimdall-watch.mjs';
import { isHubEnabled, persistLearning } from './hub-store.mjs';

export function validateJarvisRoute(route) {
  if (!route?.agent || !route?.skill) {
    return { ok: true };
  }
  return checkAgentContext({
    route_agent: route.agent,
    route_skill: route.skill,
  });
}

export async function logContextViolation({ route, messagePreview = '' }) {
  const ctx = validateJarvisRoute(route);
  if (!ctx.violation) return null;

  const content = `Contexto: ${route.agent}/${route.skill} — ${ctx.reason}`;
  console.warn(
    JSON.stringify({
      event: 'jarvis.context_violation',
      agent: route.agent,
      skill: route.skill,
      reason: ctx.reason,
    })
  );

  if (!isHubEnabled()) return { logged: false, content };

  const row = await persistLearning({
    agentId: 'heimdall',
    source: 'jarvis-context-guard',
    content,
    metadata: {
      type: 'context_violation',
      route_agent: route.agent,
      route_skill: route.skill,
      message_preview: String(messagePreview).slice(0, 200),
      reason: ctx.reason,
    },
  });
  return { logged: true, content, id: row?.id };
}
