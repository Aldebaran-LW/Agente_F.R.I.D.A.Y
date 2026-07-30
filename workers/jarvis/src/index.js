import { json, error } from './response.js';
import { requireAuth } from './auth.js';
import { sendTelegramMessage } from './telegram.js';

const AGENT_INFO = {
  agent: 'jarvis', role: 'orchestrator', owner: 'Lucas / Aldebaran-LW', version: '2.0.0-cf',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!requireAuth(request, env)) return error('unauthorized', 401);

    if (request.method === 'GET' && path === '/jarvis') {
      return json({ ok: true, ...AGENT_INFO, endpoints: {
        jarvis: 'POST /jarvis { "message": "..." }',
        macofel: 'GET /macofel/status',
        github: 'GET /github/status',
        office: 'GET /office/status',
      }});
    }

    if (request.method === 'POST' && path === '/jarvis') {
      return handleJarvisPost(request, env, ctx);
    }

    if (path === '/health') {
      return json({ ok: true, ...AGENT_INFO });
    }

    if (path === '/debug/llm') {
      return debugLlm(env);
    }

    return error('not found', 404);
  },
};

async function handleJarvisPost(request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const message = body.message || body.text || '';

  if (!message) return error('message required');

  const llm = await callLlm(message, env);
  const reply = llm.ok ? llm.reply : 'Desculpe, nao consegui processar agora.';

  ctx.waitUntil(notifyTelegram(env, message, reply));

  return json({
    ok: true, ...AGENT_INFO,
    reply, message_echo: message,
    llm: llm.ok ? llm.model : null,
  });
}

async function callLlm(message, env) {
  if (env.LLM_ROUTER) {
    try {
      const res = await env.LLM_ROUTER.fetch('https://internal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENCLAW_AUTOMATION_TOKEN}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          max_tokens: 512,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) return { ok: true, reply: data.reply, model: data.provider || 'llm-router' };
      }
    } catch (e) {
      console.error('llm-router failed:', e.message);
    }
  }

  return { ok: false, reply: 'Nenhum LLM disponivel.' };
}

async function debugLlm(env) {
  const info = { hasBinding: !!env.LLM_ROUTER, hasToken: !!env.OPENCLAW_AUTOMATION_TOKEN };
  if (!env.LLM_ROUTER) return json(info);
  try {
    const res = await env.LLM_ROUTER.fetch('https://internal/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENCLAW_AUTOMATION_TOKEN}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'responda apenas: ok' }], max_tokens: 64 }),
    });
    info.status = res.status;
    info.body = await res.text().catch(() => 'error');
  } catch (e) {
    info.error = e.message;
  }
  return json(info);
}

async function notifyTelegram(env, message, reply) {
  await sendTelegramMessage(env, `<b>Jarvis:</b>\n${reply.slice(0, 1000)}`);
}
