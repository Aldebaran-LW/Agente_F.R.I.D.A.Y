/**
 * Cliente Ollama para o gateway OpenClaw.
 * Compatível com a API OpenAI (Ollama v0.1.14+).
 * Usado como provedor local alternativo ao HF Inference / Groq.
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '30000', 10);

/** Verifica se o Ollama está acessível. */
export async function ollamaHealth() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);
    return { ok: true, models };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Gera uma resposta com o Ollama (API /api/generate).
 * @param {string} prompt
 * @param {object} opts
 * @param {string} [opts.model]
 * @param {number} [opts.temperature]
 * @param {number} [opts.numPredict]  equivale a max_tokens
 * @returns {Promise<{ok: boolean, reply?: string, model?: string, error?: string}>}
 */
export async function ollamaGenerate(prompt, { model, temperature = 0.7, numPredict = 512 } = {}) {
  const m = model || DEFAULT_MODEL;
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: m,
        prompt,
        stream: false,
        options: { temperature, num_predict: numPredict },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `Ollama HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }
    const data = await res.json();
    return { ok: true, reply: data.response, model: m };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Chat completions no formato OpenAI (compatível com Ollama /api/chat).
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} opts
 * @returns {Promise<{ok: boolean, reply?: string, model?: string, error?: string}>}
 */
export async function ollamaChat(messages, { model, temperature = 0.7, maxTokens = 512 } = {}) {
  const m = model || DEFAULT_MODEL;
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: m,
        messages,
        stream: false,
        options: { temperature, num_predict: maxTokens },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `Ollama HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }
    const data = await res.json();
    return { ok: true, reply: data.message?.content, model: m };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Pull de um modelo (operação lenta — usar com aprovação Telegram).
 * Retorna um AsyncGenerator com linhas de progresso.
 */
export async function* ollamaPull(modelName) {
  const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true }),
  });
  if (!res.ok) throw new Error(`Ollama pull HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (line.trim()) {
        try { yield JSON.parse(line); } catch { yield { status: line }; }
      }
    }
  }
}
