/**
 * Cliente Telegram ↔ Jarvis (gateway Vercel).
 * EC2: polling ou webhook chama handleTelegramUpdate().
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bridgeCallback } from './telegram-callback-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_ROOT = resolve(__dirname, '..', '..');
const OFFSET_FILE = resolve(WORKSPACE_ROOT, 'data', 'telegram-bridge-offset.json');

const SLASH_TO_JARVIS = {
  '/start': 'ajuda',
  '/help': 'ajuda',
  '/menu': 'ajuda',
  '/status': 'status macofel',
  '/github': 'repos github',
  '/sites': 'sites no ar',
  '/resumo': 'resumo portfolio',
};

export function loadEnv(file = resolve(WORKSPACE_ROOT, '.env')) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}

export function getTelegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  const gatewayBase = process.env.OPENCLAW_GATEWAY_BASE_URL?.replace(/\/$/, '');
  const automationToken = process.env.OPENCLAW_AUTOMATION_TOKEN?.trim();
  if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN ausente' };
  if (!gatewayBase || !automationToken) {
    return { ok: false, error: 'OPENCLAW_GATEWAY_BASE_URL ou OPENCLAW_AUTOMATION_TOKEN ausente' };
  }
  return {
    ok: true,
    botToken,
    adminChatId,
    gatewayBase,
    automationToken,
    bypass: process.env.VERCEL_PROTECTION_BYPASS?.trim(),
  };
}

function isAllowedChat(chatId, adminChatId) {
  if (!adminChatId) return true;
  return String(chatId) === String(adminChatId);
}

export function normalizeSlashCommand(text) {
  const t = String(text || '').trim();
  const lower = t.toLowerCase().split(/\s/)[0];
  if (lower === '/lembrete') return { type: 'callback', data: 'j:m:wa' };
  if (SLASH_TO_JARVIS[lower]) return { type: 'jarvis', message: SLASH_TO_JARVIS[lower] };
  return { type: 'jarvis', message: t };
}

export async function callJarvis(
  { message, approved = false },
  config = getTelegramConfig()
) {
  if (!config.ok) return { ok: false, error: config.error };
  const headers = {
    Authorization: `Bearer ${config.automationToken}`,
    'Content-Type': 'application/json',
  };
  if (config.bypass) headers['x-vercel-protection-bypass'] = config.bypass;

  const res = await fetch(`${config.gatewayBase}/jarvis`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, approved }),
    signal: AbortSignal.timeout(45000),
  });
  const body = await res.json().catch(() => ({}));
  return {
    ok: res.ok && body.ok !== false,
    status: res.status,
    body,
    error: body.error || (!res.ok ? `HTTP ${res.status}` : undefined),
  };
}

export async function telegramApi(method, payload, config = getTelegramConfig()) {
  if (!config.ok) return { ok: false, error: config.error };
  const url = `https://api.telegram.org/bot${config.botToken}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: Boolean(data.ok), data, error: data.description };
}

export async function answerCallbackQuery(callbackQueryId, text, config) {
  return telegramApi(
    'answerCallbackQuery',
    { callback_query_id: callbackQueryId, text: text?.slice(0, 200) || '' },
    config
  );
}

export async function sendTelegramHtml(
  chatId,
  { html, reply_markup, plainFallback },
  config = getTelegramConfig()
) {
  const payload = {
    chat_id: chatId,
    text: html || plainFallback || '…',
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (reply_markup) payload.reply_markup = reply_markup;

  let result = await telegramApi('sendMessage', payload, config);
  if (!result.ok && plainFallback) {
    result = await telegramApi(
      'sendMessage',
      {
        chat_id: chatId,
        text: plainFallback,
        ...(reply_markup ? { reply_markup } : {}),
      },
      config
    );
  }
  return result;
}

export function jarvisToTelegramSend(jarvisBody) {
  const tg = jarvisBody?.telegram;
  return {
    html: tg?.telegram_html || jarvisBody?.reply,
    plainFallback: jarvisBody?.reply,
    reply_markup: tg?.reply_markup,
  };
}

export async function sendJarvisReply(chatId, jarvisResult, config) {
  const send = jarvisToTelegramSend(jarvisResult.body ?? jarvisResult);
  return sendTelegramHtml(chatId, send, config);
}

/**
 * @returns {{ handled: boolean, kind?: string, error?: string }}
 */
export async function handleCallbackQuery(callbackQuery, config = getTelegramConfig()) {
  if (!config.ok) return { handled: false, error: config.error };

  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data;
  if (!chatId || !data) return { handled: false };

  if (!isAllowedChat(chatId, config.adminChatId)) {
    await answerCallbackQuery(callbackQuery.id, 'Chat não autorizado.', config);
    return { handled: true, kind: 'denied' };
  }

  const bridged = await bridgeCallback(data);
  if (bridged.kind === 'unknown') {
    await answerCallbackQuery(callbackQuery.id, 'Comando desconhecido.', config);
    return { handled: false };
  }

  await answerCallbackQuery(callbackQuery.id, bridged.answerText || '', config);

  if (bridged.kind === 'submenu' || bridged.kind === 'local') {
    await sendTelegramHtml(
      chatId,
      { html: bridged.localReply, reply_markup: bridged.reply_markup },
      config
    );
    return { handled: true, kind: bridged.kind };
  }

  if (bridged.kind === 'jarvis') {
    const j = await callJarvis(
      { message: bridged.message, approved: Boolean(bridged.approved) },
      config
    );
    if (!j.ok) {
      await sendTelegramHtml(chatId, {
        html: `<b>Jarvis</b>\n${j.error || 'erro'}`,
        plainFallback: j.error,
      }, config);
      return { handled: true, kind: 'jarvis_error' };
    }
    await sendJarvisReply(chatId, j, config);
    return { handled: true, kind: 'jarvis' };
  }

  return { handled: false };
}

/**
 * Mensagem de texto → Jarvis (comandos operacionais, zero LLM no gateway).
 */
export async function handleTextMessage(message, config = getTelegramConfig()) {
  if (!config.ok) return { handled: false, error: config.error };

  const chatId = message.chat?.id;
  const text = message.text?.trim();
  if (!chatId || !text) return { handled: false };

  if (!isAllowedChat(chatId, config.adminChatId)) {
    return { handled: true, kind: 'denied' };
  }

  const cmd = normalizeSlashCommand(text);
  if (cmd.type === 'callback') {
    return handleCallbackQuery(
      {
        id: `local_${Date.now()}`,
        data: cmd.data,
        message: { chat: { id: chatId } },
      },
      config
    );
  }

  const j = await callJarvis({ message: cmd.message }, config);
  if (!j.ok) {
    await sendTelegramHtml(chatId, {
      html: `<b>Jarvis</b>\n${j.error || 'indisponível'}`,
      plainFallback: j.error,
    }, config);
    return { handled: true, kind: 'jarvis_error' };
  }
  await sendJarvisReply(chatId, j, config);
  return { handled: true, kind: 'jarvis' };
}

export async function handleTelegramUpdate(update, config = getTelegramConfig()) {
  if (update.callback_query) {
    return handleCallbackQuery(update.callback_query, config);
  }
  if (update.message?.text) {
    return handleTextMessage(update.message, config);
  }
  return { handled: false, kind: 'ignored' };
}

export function loadPollOffset() {
  if (!existsSync(OFFSET_FILE)) return 0;
  try {
    return Number(JSON.parse(readFileSync(OFFSET_FILE, 'utf8')).offset) || 0;
  } catch {
    return 0;
  }
}

export function savePollOffset(offset) {
  mkdirSync(dirname(OFFSET_FILE), { recursive: true });
  writeFileSync(
    OFFSET_FILE,
    JSON.stringify({ offset, at: new Date().toISOString() }, null, 2),
    'utf8'
  );
}

/** Long polling (EC2). Para correr em paralelo ao OpenClaw, usar só admin chat. */
export async function pollTelegramOnce(config = getTelegramConfig()) {
  if (!config.ok) throw new Error(config.error);
  const offset = loadPollOffset();
  const res = await telegramApi(
    'getUpdates',
    { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] },
    config
  );
  if (!res.ok) throw new Error(res.error || 'getUpdates failed');

  const updates = res.data?.result ?? [];
  let maxId = offset;
  const results = [];

  for (const update of updates) {
    maxId = Math.max(maxId, update.update_id + 1);
    results.push({ update_id: update.update_id, ...(await handleTelegramUpdate(update, config)) });
  }

  if (maxId > offset) savePollOffset(maxId);
  return { processed: results.length, results };
}
