import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadAllAgentConfigs } from './parse-agent-yaml.mjs';
import { callMistralChat } from './mistral-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsRoot = resolve(__dirname, '..', '..', 'agents');

export function agentConfig(agentId) {
  return loadAllAgentConfigs(agentsRoot).find((a) => a.id === agentId) || null;
}

export function agentUsesMistral(agentId, env = process.env) {
  const cfg = agentConfig(agentId);
  return cfg?.provider === 'mistral' && Boolean(env.MISTRAL_API_KEY?.trim());
}

/** Senku / Gideon (ou outro) com provider mistral no config.yaml */
export async function callAgentLlm(agentId, system, user, env = process.env) {
  const cfg = agentConfig(agentId);
  if (cfg?.provider === 'mistral' && env.MISTRAL_API_KEY?.trim()) {
    return callMistralChat(
      { system, user, model: cfg.model || undefined },
      env,
    );
  }
  const key = env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;
  const model = cfg?.model || 'google/gemma-4-26b-a4b-it:free';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/Aldebaran-LW/Agente_OpenClaw',
      'X-Title': 'OpenClaw Innovation Pipeline',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export function hasInnovationLlm(env = process.env) {
  if (env.OPENROUTER_API_KEY?.trim()) return true;
  return ['senku', 'gideon'].some((id) => agentUsesMistral(id, env));
}
