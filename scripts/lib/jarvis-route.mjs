/**
 * Decide se a mensagem deve ir ao gateway /jarvis (sem LLM).
 */
import { routeMessage } from '../../gateway/lib/jarvis-router.mjs';
import { loadPending } from './scheduled-whatsapp-core.mjs';

const SLASH_JARVIS = /^\/jarvis(?:@\w+)?\s*/i;
const SLASH_OPS =
  /^\/(start|help|ajuda|menu|status|github|sites|resumo|lembrete|quotas|office|rimuru)(?:@\w+)?\b/i;

const SLASH_TO_MESSAGE = {
  start: 'ajuda',
  help: 'ajuda',
  ajuda: 'ajuda',
  menu: 'ajuda',
  status: 'status macofel',
  github: 'repos github',
  sites: 'sites no ar',
  resumo: 'resumo portfolio',
  lembrete: 'menu whatsapp', // tratado no hook → submenu botões
  quotas: 'rimuru status',
  rimuru: 'rimuru status',
  office: 'situação dos agentes',
};

/** Normaliza texto para POST /jarvis. */
export function normalizeJarvisMessage(message = '') {
  let t = String(message).trim();
  t = t.replace(SLASH_JARVIS, '').trim();

  const slash = t.match(/^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/i);
  if (slash) {
    const cmd = slash[1].toLowerCase();
    const rest = slash[2]?.trim();
    if (SLASH_TO_MESSAGE[cmd]) {
      return rest ? `${SLASH_TO_MESSAGE[cmd]} ${rest}`.trim() : SLASH_TO_MESSAGE[cmd];
    }
  }
  return t;
}

/**
 * @param {string} message
 * @returns {boolean}
 */
export function shouldUseJarvis(message = '') {
  const raw = String(message).trim();
  if (!raw) return false;

  if (SLASH_JARVIS.test(raw)) return true;
  if (SLASH_OPS.test(raw)) return true;

  if (/^(sim|confirmar|ok)\b/i.test(raw) && raw.length < 48 && loadPending()) {
    return true;
  }

  const text = normalizeJarvisMessage(raw);
  const route = routeMessage(text);

  if (route.skill === 'clarify') return false;
  return true;
}

export function describeRoute(message = '') {
  const text = normalizeJarvisMessage(message);
  return routeMessage(text);
}
