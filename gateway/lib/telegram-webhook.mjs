/**
 * Telegram Webhook Helper
 * Integra notificações direto no Worker
 */

export async function sendTelegramMessage(env, text, options = {}) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.warn('Telegram config ausente');
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text,
          parse_mode: options.parseMode || 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      console.error(`Telegram error: ${response.status}`);
    }
    return response;
  } catch (error) {
    console.error('Telegram send error:', error.message);
  }
}

export async function sendTelegramInlineKeyboard(env, text, buttons) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.warn('Telegram config ausente');
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: buttons,
          },
        }),
      }
    );

    return response;
  } catch (error) {
    console.error('Telegram keyboard error:', error.message);
  }
}

/**
 * Exemplos de uso no worker.mjs:
 * 
 * // Notificação simples
 * await sendTelegramMessage(env, '✅ Deploy concluído');
 * 
 * // Com formatação HTML
 * await sendTelegramMessage(env, '<b>Evento Importante:</b>\nOllama respondeu com erro', {
 *   parseMode: 'HTML'
 * });
 * 
 * // Com botões inline
 * await sendTelegramInlineKeyboard(env, 'Escolha uma ação:', [
 *   [
 *     { text: 'Retry', callback_data: 'retry_ollama' },
 *     { text: 'Cancel', callback_data: 'cancel' }
 *   ]
 * ]);
 */
