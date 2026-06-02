/**
 * Ponte EC2: callback_query Telegram → POST /jarvis
 * Uso na EC2 (custom hook) ou teste local:
 *   node scripts/lib/telegram-callback-bridge.mjs j:wa:list
 */
import {
  resolveCallbackToJarvisRequest,
  whatsappMenuKeyboard,
  mainMenuKeyboard,
} from '../../gateway/lib/telegram-keyboards.mjs';
import { clearPending, loadPending } from './scheduled-whatsapp-core.mjs';

export { resolveCallbackToJarvisRequest, whatsappMenuKeyboard, mainMenuKeyboard };

/**
 * @param {string} callbackData
 * @returns {Promise<{ kind: 'jarvis'|'submenu'|'local', message?: string, approved?: boolean, reply_markup?: object, answerText?: string, localReply?: string }>}
 */
export async function bridgeCallback(callbackData) {
  const req = resolveCallbackToJarvisRequest(callbackData);
  if (!req) return { kind: 'unknown' };

  if (req.submenu === 'whatsapp') {
    return {
      kind: 'submenu',
      answerText: req.answerText,
      reply_markup: whatsappMenuKeyboard(),
      localReply:
        '<b>📱 Lembretes WhatsApp</b>\n\nEscolhe um atalho ou escreve:\n<code>agendar whatsapp: DD/MM/AAAA HH:MM — texto</code>',
    };
  }

  if (req.message === '__wa_cancel_pending__') {
    const had = Boolean(loadPending());
    clearPending();
    return {
      kind: 'local',
      answerText: req.answerText,
      localReply: had
        ? 'Pedido de lembrete <b>cancelado</b>.'
        : 'Não havia lembrete pendente.',
      reply_markup: whatsappMenuKeyboard(),
    };
  }

  return {
    kind: 'jarvis',
    message: req.message,
    approved: req.approved,
    answerText: req.answerText,
  };
}
