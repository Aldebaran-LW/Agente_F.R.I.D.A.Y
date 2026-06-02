#!/usr/bin/env node
/**
 * Ponte Telegram → Jarvis (botões + texto). EC2 ou PC com .env.
 *
 * Uso:
 *   node scripts/telegram-jarvis-bridge.mjs "ajuda"
 *   node scripts/telegram-jarvis-bridge.mjs --send "status macofel"
 *   node scripts/telegram-jarvis-bridge.mjs --callback j:m:wa
 *   node scripts/telegram-jarvis-bridge.mjs --poll-once
 *   node scripts/telegram-jarvis-bridge.mjs --poll
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadEnv,
  getTelegramConfig,
  callJarvis,
  handleCallbackQuery,
  handleTextMessage,
  pollTelegramOnce,
  sendJarvisReply,
  sendTelegramHtml,
} from './lib/telegram-jarvis-client.mjs';
import { bridgeCallback } from './lib/telegram-callback-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(resolve(__dirname, '..', '.env'));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function main() {
  const cfg = getTelegramConfig();
  if (!cfg.ok) {
    console.error(cfg.error);
    process.exit(1);
  }

  const chatId = arg('--chat-id') || cfg.adminChatId;
  const dryRun = hasFlag('--dry-run');

  if (hasFlag('--poll')) {
    console.log('Polling Telegram → Jarvis (Ctrl+C para parar)…');
    for (;;) {
      try {
        const r = await pollTelegramOnce(cfg);
        if (r.processed > 0) {
          console.log(JSON.stringify({ at: new Date().toISOString(), ...r }));
        }
      } catch (e) {
        console.error('poll error:', e.message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  if (hasFlag('--poll-once')) {
    const r = await pollTelegramOnce(cfg);
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  }

  const callbackData = arg('--callback');
  if (callbackData) {
    if (!chatId) {
      console.error('Defina TELEGRAM_ADMIN_CHAT_ID ou --chat-id');
      process.exit(1);
    }
    if (dryRun) {
      console.log(JSON.stringify(await bridgeCallback(callbackData), null, 2));
      process.exit(0);
    }
    const r = await handleCallbackQuery(
      {
        id: 'cli_test',
        data: callbackData,
        message: { chat: { id: Number(chatId) } },
      },
      cfg
    );
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  }

  const message =
    arg('--send') ||
    process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ') ||
    'ajuda';

  if (dryRun) {
    const j = await callJarvis({ message }, cfg);
    console.log(JSON.stringify(j.body, null, 2));
    process.exit(j.ok ? 0 : 1);
  }

  if (hasFlag('--send-telegram') && chatId) {
    const j = await callJarvis({ message }, cfg);
    if (!j.ok) {
      console.error(j.error);
      process.exit(1);
    }
    const sent = await sendJarvisReply(chatId, j, cfg);
    console.log(JSON.stringify({ jarvis: j.body?.reply, telegram: sent }, null, 2));
    process.exit(sent.ok ? 0 : 1);
  }

  if (chatId && !hasFlag('--json-only')) {
    const j = await callJarvis({ message }, cfg);
    if (j.ok) {
      await sendJarvisReply(chatId, j, cfg);
    }
    console.log(JSON.stringify({ http: j.status, ...j.body }, null, 2));
    process.exit(j.ok ? 0 : 1);
  }

  const j = await callJarvis({ message }, cfg);
  console.log(JSON.stringify({ http: j.status, ...j.body }, null, 2));
  process.exit(j.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
