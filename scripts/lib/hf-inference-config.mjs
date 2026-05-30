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

export function orchestratorComplexFallbacks(env = process.env) {
  const out = ['deepseek/deepseek-v4-flash'];
  if (hfTokenFromEnv(env)) out.push(hfModelRef(hfInferenceModelFromEnv(env)));
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