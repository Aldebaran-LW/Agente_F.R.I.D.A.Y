export function getChatId(env) {
  return env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_CHAT_ID;
}

export async function sendTelegramMessage(env, text, options = {}) {
  const chatId = getChatId(env);
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text,
        parse_mode: options.parseMode || 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}
