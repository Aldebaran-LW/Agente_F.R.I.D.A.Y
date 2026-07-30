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
  const providers = [];

  if (env.GROQ_API_KEY) {
    providers.push(() => groqQuery(message, env));
  }
  if (env.DEEPSEEK_API_KEY) {
    providers.push(() => deepseekQuery(message, env));
  }
  if (env.OPENROUTER_API_KEY) {
    providers.push(() => openrouterQuery(message, env));
  }
  if (env.HF_TOKEN) {
    providers.push(() => hfQuery(message, env));
  }

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result.ok) return result;
    } catch (e) {
      console.error(`LLM provider failed:`, e.message);
    }
  }

  return { ok: false, reply: 'Nenhum LLM disponivel.' };
}

async function groqQuery(message, env) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: 'Agente OpenClaw. Responda em portuguÃªs.' }, { role: 'user', content: message }],
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return { ok: true, reply: data.choices?.[0]?.message?.content || '...', model: 'groq' };
}

async function deepseekQuery(message, env) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: 'Agente OpenClaw. Responda em portuguÃªs.' }, { role: 'user', content: message }],
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return { ok: true, reply: data.choices?.[0]?.message?.content || '...', model: 'deepseek' };
}

async function openrouterQuery(message, env) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://openclaw.lwdigitalforge.com',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      messages: [{ role: 'system', content: 'Agente OpenClaw. Responda em portuguÃªs.' }, { role: 'user', content: message }],
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return { ok: true, reply: data.choices?.[0]?.message?.content || '...', model: 'openrouter' };
}

async function hfQuery(message, env) {
  const res = await fetch(`https://api-inference.huggingface.co/models/${env.HF_INFERENCE_MODEL || 'Qwen/Qwen2.5-7B-Instruct:fastest'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.HF_TOKEN}` },
    body: JSON.stringify({ inputs: message, parameters: { max_new_tokens: 512 } }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  const reply = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
  return { ok: !!reply, reply: reply || '...', model: 'huggingface' };
}

async function notifyTelegram(env, message, reply) {
  await sendTelegramMessage(env, `<b>Jarvis:</b>\n${reply.slice(0, 1000)}`);
}


