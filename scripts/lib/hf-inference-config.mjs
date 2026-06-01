/**
 * HF Inference Router — config partilhada (OpenClaw provider `huggingface`)
 * Docs: docs/HF-INFERENCE-ROUTER.md
 */

export const HF_ROUTER_BASE_URL = 'https://router.huggingface.co/v1';

export const HF_INFERENCE_MODEL_DEFAULT = 'Qwen/Qwen2.5-7B-Instruct:fastest';

export const OLLAMA_SIMPLE_MODEL = 'ollama/smollm2:360m';

export const DEEPSEEK_PRIMARY_MODEL = 'deepseek/deepseek-v4-flash';

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

/** Telegram/Jarvis: HF Router (32k+, grátis) — Ollama smollm2 não cabe o prompt (~4k+). */
export function orchestratorPrimaryModel(env = process.env) {
  if (hfTokenFromEnv(env)) return hfModelRef(hfInferenceModelFromEnv(env));
  if (groqTokenFromEnv(env)) return groqModelRef(env);
  if (infronTokenFromEnv(env)) return infronModelRef(env);
  if (env.DEEPSEEK_API_KEY?.trim()) return DEEPSEEK_PRIMARY_MODEL;
  return null;
}

/** Modelo cloud para cérebros secundários na EC2 (sem Ollama local). */
export function ec2BackgroundModel(env = process.env) {
  return orchestratorPrimaryModel(env) || hfModelRef();
}

export function orchestratorComplexFallbacks(env = process.env) {
  const primary = orchestratorPrimaryModel(env);
  const out = [];
  const push = (ref) => {
    if (ref && ref !== primary && !out.includes(ref)) out.push(ref);
  };
  push(groqTokenFromEnv(env) ? groqModelRef(env) : null);
  push(infronTokenFromEnv(env) ? infronModelRef(env) : null);
  push(env.DEEPSEEK_API_KEY?.trim() ? DEEPSEEK_PRIMARY_MODEL : null);
  if (hfTokenFromEnv(env)) push(hfModelRef(hfInferenceModelFromEnv(env)));
  return out.filter((m) => m !== primary);
}

function modelMeta(id, name, contextWindow, maxTokens = 8192) {
  return {
    id,
    name,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow,
    maxTokens,
  };
}

export function applyHfProvider(doc, env = process.env) {
  const token = hfTokenFromEnv(env);
  if (!token) return false;
  const modelId = hfInferenceModelFromEnv(env);
  doc.models = doc.models || {};
  doc.models.providers = doc.models.providers || {};
  doc.models.providers.huggingface = {
    apiKey: token,
    baseUrl: HF_ROUTER_BASE_URL,
    models: [modelMeta(modelId, 'HF Inference Router', 32768)],
  };
  return true;
}

export function applyDeepseekProvider(doc, env = process.env) {
  const token = env.DEEPSEEK_API_KEY?.trim();
  if (!token) return false;
  doc.models = doc.models || {};
  doc.models.providers = doc.models.providers || {};
  doc.models.providers.deepseek = {
    apiKey: token,
    baseUrl: 'https://api.deepseek.com',
    models: [
      modelMeta('deepseek-v4-flash', 'DeepSeek V4 Flash', 64000),
      modelMeta('deepseek-chat', 'DeepSeek Chat', 64000),
    ],
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
    models: [modelMeta(modelId, 'Infron fallback', 64000)],
  };
  return true;
}

export function applyGroqProvider(doc, env = process.env) {
  const token = groqTokenFromEnv(env);
  if (!token) return false;
  const modelId = groqModelFromEnv(env);
  doc.models = doc.models || {};
  doc.models.providers = doc.models.providers || {};
  doc.models.providers.groq = {
    apiKey: token,
    baseUrl: env.GROQ_BASE_URL?.trim() || GROQ_BASE_URL_DEFAULT,
    models: [modelMeta(modelId, 'Groq LPU', 128000)],
  };
  return true;
}

/** Garante contextWindow nos providers cloud (evita precheck 4096 no HF). */
export function applyProviderContextWindows(doc, env = process.env) {
  applyDeepseekProvider(doc, env);
  applyHfProvider(doc, env);
  applyInfronProvider(doc, env);
  applyGroqProvider(doc, env);
}
