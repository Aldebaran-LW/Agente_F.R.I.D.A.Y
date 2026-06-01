/**
 * Teclados inline Telegram (atalhos Jarvis / WhatsApp).
 * callback_data ≤ 64 bytes — prefixo j:
 * https://core.telegram.org/bots/api#inlinekeyboardmarkup
 */

/** @returns {import('./telegram-keyboards.mjs').ReplyMarkup} */
export function inlineKeyboard(rows) {
  return { inline_keyboard: rows };
}

export function btn(text, callbackData) {
  return { text, callback_data: callbackData };
}

/** Menu principal (ajuda / start). */
export function mainMenuKeyboard() {
  return inlineKeyboard([
    [
      btn('📋 Resumo', 'j:p:portfolio'),
      btn('🏪 Macofel', 'j:p:macofel'),
    ],
    [
      btn('📱 WhatsApp', 'j:m:wa'),
      btn('🔧 GitHub', 'j:p:github'),
    ],
    [btn('🌐 Sites', 'j:p:sites'), btn('❓ Ajuda', 'j:h:help')],
  ]);
}

/** Submenu lembretes WhatsApp. */
export function whatsappMenuKeyboard() {
  return inlineKeyboard([
    [
      btn('☀️ Amanhã 9h', 'j:wa:p:tomorrow9'),
      btn('🌆 Hoje 18h', 'j:wa:p:today18'),
    ],
    [btn('📋 Meus agendamentos', 'j:wa:list')],
    [
      btn('✅ Confirmar', 'j:wa:ok'),
      btn('❌ Cancelar pedido', 'j:wa:cancel'),
    ],
    [btn('◀️ Menu principal', 'j:h:help')],
  ]);
}

/** Aprovação de lembrete pendente. */
export function whatsappConfirmKeyboard() {
  return inlineKeyboard([
    [btn('✅ Sim, agendar', 'j:wa:ok'), btn('❌ Não', 'j:wa:cancel')],
    [btn('📱 Outro horário', 'j:m:wa')],
  ]);
}

/** Depois de agendar com sucesso. */
export function whatsappDoneKeyboard() {
  return inlineKeyboard([
    [btn('📋 Ver agendamentos', 'j:wa:list'), btn('📱 Novo lembrete', 'j:m:wa')],
    [btn('◀️ Menu', 'j:h:help')],
  ]);
}

/** Aprovação genérica (sync, hefestos…). */
export function approvalKeyboard() {
  return inlineKeyboard([
    [
      btn('✅ sim', 'j:ok:sim'),
      btn('✅ confirmar', 'j:ok:confirmar'),
      btn('✅ ok', 'j:ok:ok'),
    ],
  ]);
}

/**
 * Converte callback_data do Telegram em pedido ao Jarvis (ou submenu só UI).
 * @returns {{
 *   message?: string,
 *   approved?: boolean,
 *   submenu?: 'whatsapp' | 'main',
 *   answerText?: string,
 * } | null}
 */
export function resolveCallbackToJarvisRequest(callbackData) {
  const d = String(callbackData || '').trim();
  if (!d.startsWith('j:')) return null;

  const map = {
    'j:h:help': { message: 'ajuda', answerText: 'Menu Jarvis' },
    'j:p:portfolio': { message: 'resumo portfolio', answerText: 'Portfolio…' },
    'j:p:macofel': { message: 'status macofel', answerText: 'Macofel…' },
    'j:p:github': { message: 'repos github', answerText: 'GitHub…' },
    'j:p:sites': { message: 'sites no ar', answerText: 'Sites…' },
    'j:m:wa': { submenu: 'whatsapp', answerText: 'Lembretes WhatsApp' },
    'j:wa:list': {
      message: 'lista agendamentos whatsapp',
      answerText: 'A carregar…',
    },
    'j:wa:ok': { message: 'sim', approved: true, answerText: 'Confirmado' },
    'j:wa:cancel': {
      message: '__wa_cancel_pending__',
      answerText: 'Cancelado',
    },
    'j:wa:p:tomorrow9': {
      message: 'agendar whatsapp: amanhã 9:00 — Lembrete FRIDAY',
      answerText: 'Pré-agendar amanhã 9h…',
    },
    'j:wa:p:today18': {
      message: 'agendar whatsapp: hoje 18:00 — Lembrete FRIDAY',
      answerText: 'Pré-agendar hoje 18h…',
    },
    'j:ok:sim': { message: 'sim', approved: true, answerText: 'sim' },
    'j:ok:confirmar': { message: 'confirmar', approved: true, answerText: 'confirmar' },
    'j:ok:ok': { message: 'ok', approved: true, answerText: 'ok' },
  };

  return map[d] ?? null;
}

/** Escolhe teclado conforme rota/resposta Jarvis. */
export function pickReplyMarkup({
  route,
  payload,
  approvalBlocked,
  plainReply,
}) {
  if (approvalBlocked) return approvalKeyboard();

  const skill = route?.skill;
  if (skill === 'help') return mainMenuKeyboard();

  if (skill === 'schedule-whatsapp') {
    if (payload?.needsApproval) return whatsappConfirmKeyboard();
    if (payload?.ok && payload?.item) return whatsappDoneKeyboard();
    if (payload?.reply?.includes('Agendados')) return whatsappMenuKeyboard();
    return whatsappMenuKeyboard();
  }

  if (plainReply && /Lembrete WhatsApp para/i.test(plainReply)) {
    return whatsappConfirmKeyboard();
  }

  return null;
}
