/**
 * HF Inference Router — config partilhada (OpenClaw provider `huggingface`)
 * Docs: docs/HF-INFERENCE-ROUTER.md
 */

export const HF_ROUTER_BASE_URL = 'https://router.huggingface.co/v1';

export const HF_INFERENCE_MODEL_DEFAULT = 'Qwen/Qwen2.5-7B-Instruct:fastest';

export function hfTokenFromEnv(env = process.env) {
  return env.HF_TOKEN?.trim() || env.HUGGINGFACE_HUB_TOKEN?.trim() || '';
}

export function hfInferenceModelFromEnv(env = process.env) {
  return env.HF_INFERENCE_MODEL?.trim() || HF_INFERENCE_MODEL_DEFAULT;
}

export function hfModelRef(modelId = hfInferenceModelFromEnv()) {
  const id = modelId.startsWith('huggingface/')
    ? modelId.slice('huggingface/'.length)
    : modelId;
  return `huggingface/${id}`;
}

export const INFRON_BASE_URL_DEFAULT = 'https://llm.onerouter.pro/v1';

export const INFRON_MODEL_DEFAULT = 'deepseek/deepseek-v3.2';

export function infronTokenFromEnv(env = process.env) {
  return env.INFRON_API_KEY?.trim() || '';
}

export function infronModelFromEnv(env = process.env) {
  return env.INFRON_MODEL?.trim() || INFRON_MODEL_DEFAULT;
}

export function infronModelRef(env = process.env) {
  const model = infronModelFromEnv(env);
  return model.startsWith('infron/') ? model : `infron/${model}`;
}

export const GROQ_BASE_URL_DEFAULT = 'https://api.groq.com/openai/v1';

export const GROQ_MODEL_DEFAULT = 'llama-3.3-70b-versatile';

export function groqTokenFromEnv(env = process.env) {
  return env.GROQ_API_KEY?.trim() || '';
}

export function groqModelFromEnv(env = process.env) {
  return env.GROQ_MODEL?.trim() || GROQ_MODEL_DEFAULT;
}

export function groqModelRef(env = process.env) {
  const model = groqModelFromEnv(env);
  return model.startsWith('groq/') ? model : `groq/${model}`;
}

export function orchestratorComplexFallbacks(env = process.env) {
  const out = ['deepseek/deepseek-v4-flash'];
  if (hfTokenFromEnv(env)) out.push(hfModelRef(hfInferenceModelFromEnv(env)));
  if (infronTokenFromEnv(env)) out.push(infronModelRef(env));
  if (groqTokenFromEnv(env)) out.push(groqModelRef(env));
  return out;
}

export function applyHfProvider(doc, env = process.env) {
  const token = hfTokenFromEnv(env);
  if (!token) return false;
  doc.models = doc.models || {};
  doc.models.providers = doc.models.providers || {};
  doc.models.providers.huggingface = {
    apiKey: token,
    baseUrl: HF_ROUTER_BASE_URL,
  };
  return true;
}

export function applyInfronProvider(doc, env = process.env) {
  const token = infronTokenFromEnv(env);
  if (!token) return false;
  const modelId = infronModelFromEnv(env);
  doc.models = doc.models || {};
  doc.models.providers = doc.models.providers || {};
  doc.models.providers.infron = {
    apiKey: token,
    baseUrl: env.INFRON_BASE_URL?.trim() || INFRON_BASE_URL_DEFAULT,
    models: [
      {
        id: modelId,
        name: 'Infron fallback',
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 64000,
        maxTokens: 8192,
      },
    ],
  };
  return true;
}

export function applyGroqProvider(doc, env = process.env) {
  const token = groqTokenFromEnv(env);
  if (!token) return false;
  doc.models = doc.models || {};
  doc.models.providers = doc.models.providers || {};
  doc.models.providers.groq = {
    apiKey: token,
    baseUrl: env.GROQ_BASE_URL?.trim() || GROQ_BASE_URL_DEFAULT,
  };
  return true;
}