import { json, error } from './response.js';
import { requireAuth } from './auth.js';

const PROVIDERS = [
  {
    name: 'workers-ai',
    type: 'cf-ai',
    model: '@cf/meta/llama-3.2-3b-instruct',
  },
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 1024,
  },
  {
    name: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    maxTokens: 1024,
    headers: { 'HTTP-Referer': 'https://openclaw.lwdigitalforge.com' },
  },
  {
    name: 'deepseek',
    envKey: 'DEEPSEEK_API_KEY',
    url: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    maxTokens: 1024,
  },
  {
    name: 'huggingface',
    envKey: 'HF_TOKEN',
    type: 'hf',
    modelKey: 'HF_INFERENCE_MODEL',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct:fastest',
  },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!requireAuth(request, env)) return error('unauthorized', 401);

    if (request.method === 'GET' && (path === '/health' || path === '/')) {
      const available = PROVIDERS.filter(p => isAvailable(p, env)).map(p => p.name);
      return json({ ok: true, agent: 'llm-router', version: '2.0.0', providers: available });
    }

    if (request.method === 'POST' && (path === '/v1/chat/completions' || path === '/chat')) {
      return handleChat(request, env);
    }

    return error('not found', 404);
  },
};

async function handleChat(request, env) {
  const body = await request.json().catch(() => ({}));
  const messages = body.messages || [];
  const stream = body.stream === true;

  if (!messages.length) return error('messages required');

  const lastErr = [];

  for (const provider of PROVIDERS) {
    if (!isAvailable(provider, env)) continue;
    try {
      const result = await query(provider, messages, body, env, stream);
      if (result) return result;
    } catch (e) {
      console.error(`${provider.name} failed:`, e.message);
      lastErr.push(`${provider.name}: ${e.message}`);
    }
  }

  return json({ ok: false, error: 'all providers failed' }, 503);
}

function prepMessages(msgs) {
  const hasSystem = msgs.some(m => m.role === 'system');
  if (!hasSystem) return [{ role: 'system', content: 'Agente OpenClaw. Responda em portugues de forma concisa.' }, ...msgs];
  return msgs;
}

async function query(provider, messages, body, env, stream) {
  if (provider.type === 'cf-ai') {
    return cfAiQuery(provider, messages, body, env);
  }

  if (provider.type === 'hf') {
    return hfQuery(provider, messages, body, env);
  }

  const payload = {
    model: body.model || provider.model,
    messages: prepMessages(messages),
    max_tokens: body.max_tokens || provider.maxTokens,
    stream,
  };

  const res = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env[provider.envKey]}`,
      ...(provider.headers || {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  }

  if (stream) return res;

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('empty response');
  return json({ ok: true, reply, model: data.model || provider.name, provider: provider.name });
}

function isAvailable(provider, env) {
  if (provider.type === 'cf-ai') return !!env.AI;
  if (provider.envKey) return !!env[provider.envKey];
  return true;
}

async function cfAiQuery(provider, messages, body, env) {
  const msgs = prepMessages(messages);
  const result = await env.AI.run(provider.model, {
    messages: msgs,
    max_tokens: body.max_tokens || 1024,
  });
  const reply = result.response;
  if (!reply) throw new Error('empty response');
  return json({ ok: true, reply, model: provider.model, provider: provider.name });
}

async function hfQuery(provider, messages, body, env) {
  const model = env[provider.modelKey] || provider.defaultModel;
  const lastMsg = messages[messages.length - 1]?.content || '';
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env[provider.envKey]}` },
    body: JSON.stringify({ inputs: lastMsg, parameters: { max_new_tokens: body.max_tokens || 512 } }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  const reply = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
  if (!reply) throw new Error('empty response');
  return json({ ok: true, reply, model, provider: provider.name });
}
