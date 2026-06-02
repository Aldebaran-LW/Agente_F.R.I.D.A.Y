#!/usr/bin/env node
/**
 * Hook OpenClaw → gateway Jarvis (um bot, sem polling duplicado).
 *
 * Exit 0 + JSON { handled:true, ... } → OpenClaw envia isto e NÃO usa LLM.
 * Exit 2 + { handled:false } → OpenClaw continua com LLM normal.
 *
 * Uso:
 *   node scripts/openclaw-jarvis-hook.mjs "status macofel"
 *   node scripts/openclaw-jarvis-hook.mjs "/jarvis repos github"
 *   echo "ajuda" | node scripts/openclaw-jarvis-hook.mjs --stdin
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  shouldUseJarvis,
  normalizeJarvisMessage,
  describeRoute,
} from './lib/jarvis-route.mjs';
import { callJarvis, loadEnv } from './lib/telegram-jarvis-client.mjs';
import { bridgeCallback } from './lib/telegram-callback-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(resolve(__dirname, '..', '.env'));

function readMessage() {
  if (process.argv.includes('--stdin')) {
    return Promise.resolve(readFileSync(0, 'utf8').trim());
  }
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  return Promise.resolve(args.join(' ').trim());
}

async function main() {
  const raw = await readMessage();
  const force = process.argv.includes('--force');
  const approved = process.argv.includes('--approved');
  const callback = process.argv.find((a) => a.startsWith('--callback='))?.slice(11);

  if (callback) {
    const bridged = await bridgeCallback(callback);
    if (bridged.kind === 'jarvis') {
      const j = await callJarvis({
        message: bridged.message,
        approved: Boolean(bridged.approved),
      });
      outJarvis(j, describeRoute(bridged.message));
      return;
    }
    console.log(
      JSON.stringify({
        handled: true,
        source: 'callback',
        reply: bridged.localReply || bridged.answerText,
        telegram_html: bridged.localReply,
        reply_markup: bridged.reply_markup,
      })
    );
    process.exit(0);
  }

  if (!raw && !force) {
    console.log(JSON.stringify({ handled: false, reason: 'empty' }));
    process.exit(2);
  }

  if (!force && !shouldUseJarvis(raw)) {
    console.log(
      JSON.stringify({
        handled: false,
        reason: 'free_chat',
        hint: 'Use /jarvis <comando> para forçar o gateway',
      })
    );
    process.exit(2);
  }

  const message = normalizeJarvisMessage(raw);

  if (/^menu whatsapp$/i.test(message)) {
    const bridged = await bridgeCallback('j:m:wa');
    console.log(
      JSON.stringify({
        handled: true,
        source: 'submenu',
        reply: bridged.localReply,
        telegram_html: bridged.localReply,
        reply_markup: bridged.reply_markup,
      })
    );
    process.exit(0);
  }

  const route = describeRoute(raw);
  const j = await callJarvis({
    message,
    approved: approved || /^(sim|confirmar|ok)\b/i.test(message),
  });
  outJarvis(j, route);
}

function outJarvis(j, route) {
  if (!j.ok) {
    console.log(
      JSON.stringify({
        handled: true,
        ok: false,
        error: j.error,
        reply: `Jarvis indisponível: ${j.error}`,
        route,
      })
    );
    process.exit(0);
  }

  const body = j.body ?? {};
  console.log(
    JSON.stringify({
      handled: true,
      ok: true,
      route: body.plan?.route ?? route,
      reply: body.reply,
      telegram_html: body.telegram?.telegram_html ?? body.reply,
      reply_markup: body.telegram?.reply_markup ?? null,
      parse_mode: body.telegram?.parse_mode ?? 'HTML',
      approval: body.approval,
    })
  );
  process.exit(0);
}

main().catch((e) => {
  console.log(JSON.stringify({ handled: false, error: String(e.message || e) }));
  process.exit(1);
});
