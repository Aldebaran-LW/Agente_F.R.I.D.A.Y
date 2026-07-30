import { json, error } from './response.js';
import { requireAuth } from './auth.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!requireAuth(request, env)) return error('unauthorized', 401);

    if (path === '/status') return handleStatus(env);
    if (path === '/run' && request.method === 'POST') return handleRun(request, env);
    if (path === '/health') return json({ ok: true, agent: 'innovation', version: '2.0.0-cf' });

    return error('not found', 404);
  },
};

async function handleStatus(env) {
  const dataDir = 'innovation-status';
  return json({
    ok: true, at: new Date().toISOString(),
    pipelines: ['sophia', 'yato', 'senku', 'gideon'],
    lastRun: null,
  });
}

async function handleRun(request, env) {
  const body = await request.json().catch(() => ({}));
  const topic = body.topic || 'IA devtools agentes openclaw';

  const steps = [];
  const llmKey = env.OPENROUTER_API_KEY || env.DEEPSEEK_API_KEY || env.GROQ_API_KEY;

  if (!llmKey) {
    return json({ ok: false, error: 'nenhuma chave LLM configurada para inovacao' }, 503);
  }

  const provider = env.OPENROUTER_API_KEY ? 'openrouter' :
    env.DEEPSEEK_API_KEY ? 'deepseek' : 'groq';

  try {
    const research = await callLLM(`Pesquise sobre: ${topic}. Liste tendencias e oportunidades.`, llmKey, provider, env);
    steps.push({ step: 'sophia', ok: true, result: research.slice(0, 500) });

    const market = await callLLM(`Analise mercado para: ${topic}. Concorrentes, tamanho, crescimento.`, llmKey, provider, env);
    steps.push({ step: 'yato', ok: true, result: market.slice(0, 500) });

    const analysis = await callLLM(`Sintetize: pesquisa="${research.slice(0,300)}" mercado="${market.slice(0,300)}". Recomendacao.`, llmKey, provider, env);
    steps.push({ step: 'senku', ok: true, result: analysis.slice(0, 500) });

    const prediction = await callLLM(`Com base em: ${analysis.slice(0,300)}. Score 0-100 de viabilidade. Recomendar: hefestos ou adiar.`, llmKey, provider, env);
    steps.push({ step: 'gideon', ok: true, result: prediction.slice(0, 500) });

    return json({
      ok: true, topic, at: new Date().toISOString(),
      steps,
      recomendacao: prediction.includes('hefestos') ? 'construir' : 'adiar',
    });
  } catch (e) {
    return json({ ok: false, error: e.message, steps }, 502);
  }
}

async function callLLM(prompt, apiKey, provider, env) {
  let url, body;
  if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    body = {
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    };
  } else if (provider === 'deepseek') {
    url = 'https://api.deepseek.com/chat/completions';
    body = {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    };
  } else {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    body = {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '...';
}


