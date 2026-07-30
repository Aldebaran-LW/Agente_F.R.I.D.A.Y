/**
 * OpenClaw Worker — Cloudflare
 * Orquestrador de agentes multi-agent com cache KV + Telegram
 */

import { sendTelegramMessage } from './lib/telegram-webhook.mjs';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /jarvis
    if (request.method === 'GET' && path === '/jarvis') {
      return respond(200, {
        ok: true,
        agent: 'jarvis',
        version: '1.2.1-cloudflare-kv-telegram',
        environment: env.ENVIRONMENT || 'staging',
        kv: env.KV_OPENCLAW ? 'enabled' : 'disabled',
        telegram: env.TELEGRAM_BOT_TOKEN ? 'enabled' : 'disabled',
        skills: ['ollama-local', 'macofel-status', 'github-aldebaran'],
      });
    }

    // POST /jarvis com KV cache + Telegram
    if (request.method === 'POST' && path === '/jarvis') {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {
        return respond(400, { ok: false, error: 'invalid json' });
      }

      const message = body.message || '';
      const cacheKey = `msg:${hashString(message)}`;
      
      // Tentar cache KV
      if (env.KV_OPENCLAW) {
        try {
          const cached = await env.KV_OPENCLAW.get(cacheKey, 'json');
          if (cached) {
            return respond(200, { ...cached, cached_from_kv: true });
          }
        } catch (e) {
          console.error('KV read error:', e.message);
        }
      }

      let skill = 'unknown';
      let reply = '';

      if (message.toLowerCase().startsWith('/ollama')) {
        skill = 'ollama-local';
        reply = 'Ollama: ' + message.substring(0, 50);
        // Notificar Telegram
        ctx.waitUntil(
          sendTelegramMessage(env, '<b>Ollama:</b> Nova consulta recebida\n<code>' + message.substring(0, 50) + '</code>')
        );
      } else if (message.toLowerCase().startsWith('/macofel')) {
        skill = 'macofel-status';
        reply = 'Macofel status: ok';
        ctx.waitUntil(
          sendTelegramMessage(env, '<b>Macofel:</b> Status consultado')
        );
      } else if (message.toLowerCase().startsWith('/github')) {
        skill = 'github-aldebaran';
        reply = 'GitHub status: connected';
        ctx.waitUntil(
          sendTelegramMessage(env, '<b>GitHub:</b> Status consultado')
        );
      } else {
        reply = 'Comandos: /ollama, /macofel, /github';
      }

      const response = {
        ok: true,
        agent: 'jarvis',
        skill,
        reply,
        message_echo: message,
      };

      // Guardar no KV (TTL 1 hora = 3600s)
      if (env.KV_OPENCLAW) {
        try {
          await env.KV_OPENCLAW.put(cacheKey, JSON.stringify(response), {
            expirationTtl: 3600,
          });
        } catch (e) {
          console.error('KV write error:', e.message);
        }
      }

      return respond(200, response);
    }

    // GET /health
    if (request.method === 'GET' && path === '/health') {
      const health = {
        ok: true,
        timestamp: new Date().toISOString(),
        services: { workers: 'up' },
      };

      try {
        const res = await fetch(`${env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`, {
          signal: AbortSignal.timeout(3000),
        });
        health.services.ollama = res.ok ? 'up' : `http ${res.status}`;
      } catch (e) {
        health.services.ollama = `error: ${e.message}`;
      }

      // KV health
      if (env.KV_OPENCLAW) {
        try {
          const test = await env.KV_OPENCLAW.get('health-check');
          health.services.kv = 'up';
        } catch (e) {
          health.services.kv = `error: ${e.message}`;
        }
      }

      // Telegram health
      health.services.telegram = env.TELEGRAM_BOT_TOKEN ? 'configured' : 'unconfigured';

      return respond(200, health);
    }

    return respond(404, { ok: false, error: 'not found' });
  },
};

function respond(status, data) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Hash simples para cache key
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
