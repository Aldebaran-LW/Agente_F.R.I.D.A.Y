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
        voice: 'POST /jarvis/voice { "audio_url": "..." }',
        imagem: 'POST /jarvis/imagem { "prompt": "..." }',
        macofel: 'GET /macofel/status',
        github: 'GET /github/status',
        office: 'GET /office/status',
      }});
    }

    if (request.method === 'POST' && path === '/jarvis') {
      return handleJarvisPost(request, env, ctx);
    }

    if (request.method === 'POST' && path === '/jarvis/voice') {
      return handleVoice(request, env, ctx);
    }

    if (request.method === 'POST' && path === '/jarvis/imagem') {
      return handleImage(request, env, ctx);
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

  const context = await searchKnowledge(env, message);
  const contextStr = context?.length
    ? '\n\nContexto relevante:\n' + context.map((h) => `- ${h.message}: ${h.reply}`).join('\n')
    : '';

  const llm = await callLlm(message + contextStr, env);
  const reply = llm.ok ? llm.reply : 'Desculpe, nao consegui processar agora.';

  ctx.waitUntil(indexConversation(env, message, reply));
  ctx.waitUntil(notifyTelegram(env, message, reply));

  return json({
    ok: true, ...AGENT_INFO,
    reply, message_echo: message,
    llm: llm.ok ? llm.model : null,
    contextUsed: !!context?.length,
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

async function handleVoice(request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const audioUrl = body.audio_url;

  if (!audioUrl) return error('audio_url required');

  let audioBuffer;
  try {
    const res = await fetch(audioUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    audioBuffer = await res.arrayBuffer();
  } catch (e) {
    return error(`failed to fetch audio: ${e.message}`, 502);
  }

  if (audioBuffer.byteLength > 25 * 1024 * 1024) {
    return error('audio too large (max 25MB)', 413);
  }

  const bytes = new Uint8Array(audioBuffer);
  let text;
  try {
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = env.CLOUDFLARE_API_TOKEN;
    if (accountId && apiToken) {
      const audioBase64 = btoa(String.fromCharCode(...bytes));
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/openai/whisper-large-v3-turbo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ audio: audioBase64 }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`whisper API: ${res.status}`);
      const data = await res.json();
      text = data.result?.text;
    } else if (env.AI) {
      const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
        audio: bytes,
      });
      text = result.text;
    } else {
      return error('AI or Cloudflare API credentials not configured', 503);
    }
  } catch (e) {
    console.error('whisper failed:', e.message);
    return error(`transcription failed: ${e.message}`, 502);
  }

  if (!text || !text.trim()) {
    return error('empty transcription', 502);
  }

  ctx.waitUntil(notifyTelegram(env, `[Voz transcrita]\n${text.slice(0, 200)}`, ''));

  return json({ ok: true, text, model: 'whisper-large-v3-turbo', provider: 'workers-ai' });
}

async function handleImage(request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const prompt = body.prompt;

  if (!prompt) return error('prompt required');
  if (prompt.length > 2048) return error('prompt too long (max 2048 chars)', 400);

  let result;
  try {
    if (env.AI) {
      result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
        prompt,
        seed: Math.floor(Math.random() * 10000),
        steps: 4,
      });
    } else {
      return error('AI binding not configured', 503);
    }
  } catch (e) {
    console.error('flux failed:', e.message);
    return error(`image generation failed: ${e.message}`, 502);
  }

  if (!result || !result.image) {
    return error('empty image result', 502);
  }

  const base64 = result.image;
  const dataUri = `data:image/jpeg;base64,${base64}`;

  ctx.waitUntil(
    sendTelegramImage(env, dataUri, prompt.slice(0, 200)),
  );

  return json({ ok: true, image: dataUri, prompt, model: 'flux-1-schnell', provider: 'workers-ai' });
}

async function sendTelegramImage(env, dataUri, caption) {
  const chatId = env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_CHAT_ID;
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: dataUri,
        caption: caption ? `🖼 ${caption}` : undefined,
        parse_mode: 'HTML',
      }),
    });
  } catch (e) {
    console.error('Telegram image error:', e.message);
  }
}

async function searchKnowledge(env, query) {
  if (!env.INTEGRATION) return null;
  try {
    const res = await env.INTEGRATION.fetch(`https://internal/search/indexes/conversations/search?q=${encodeURIComponent(query)}&limit=3`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return data.hits || [];
    }
  } catch (e) {
    console.error('search failed:', e.message);
  }
  return null;
}

async function indexConversation(env, message, reply) {
  if (!env.INTEGRATION) return;
  try {
    await env.INTEGRATION.fetch('https://internal/search/indexes/conversations/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `msg_${Date.now()}`,
        message: message.slice(0, 500),
        reply: reply.slice(0, 500),
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error('index failed:', e.message);
  }
}

async function notifyApprise(env, title, body, tag = 'openclaw') {
  if (!env.INTEGRATION) return;
  try {
    await env.INTEGRATION.fetch(`https://internal/notify/${tag}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });
  } catch (e) {
    console.error('notify failed:', e.message);
  }
}

async function notifyTelegram(env, message, reply) {
  await sendTelegramMessage(env, `<b>Jarvis:</b>\n${reply.slice(0, 1000)}`);
}
