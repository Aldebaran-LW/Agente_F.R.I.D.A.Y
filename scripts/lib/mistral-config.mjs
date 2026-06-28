/**
 * Mistral API directa — Senku / Gideon (cota free separada do Groq/Jarvis)
 * Docs: https://docs.mistral.ai/
 */

export const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';

export const MISTRAL_MODEL_DEFAULT = 'mistral-small-latest';

export function mistralTokenFromEnv(env = process.env) {
  return env.MISTRAL_API_KEY?.trim() || '';
}

export function mistralModelFromEnv(env = process.env) {
  return env.MISTRAL_MODEL?.trim() || MISTRAL_MODEL_DEFAULT;
}

export function mistralModelRef(model = mistralModelFromEnv()) {
  return model.startsWith('mistral/') ? model : `mistral/${model}`;
}

export function applyMistralProvider(doc, env = process.env) {
  const token = mistralTokenFromEnv(env);
  if (!token) return false;
  const modelId = mistralModelFromEnv(env);
  doc.models = doc.models || {};
  doc.models.providers = doc.models.providers || {};
  doc.models.providers.mistral = {
    apiKey: token,
    baseUrl: MISTRAL_BASE_URL,
    models: [
      {
        id: modelId,
        name: 'Mistral Small',
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32768,
        maxTokens: 8192,
      },
    ],
  };
  return true;
}

/**
 * @param {{ system: string, user: string, model?: string, maxTokens?: number }} opts
 */
export async function callMistralChat(opts, env = process.env) {
  const key = mistralTokenFromEnv(env);
  if (!key) return null;
  const model = opts.model || mistralModelFromEnv(env);
  const res = await fetch(`${MISTRAL_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}
