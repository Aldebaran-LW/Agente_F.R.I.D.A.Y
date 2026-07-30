/**
 * Handler da skill ollama-local para o gateway OpenClaw.
 * Roteado via jarvis-router → jarvis.mjs → aqui.
 */

import { ollamaGenerate, ollamaHealth, ollamaPull } from '../lib/ollama.mjs';

const PULL_REQUIRES_APPROVAL = true;

/**
 * @param {string} text  — texto da mensagem Telegram (já sem /ollama)
 * @param {object} ctx   — { approvalGranted?: boolean }
 * @returns {Promise<{ok: boolean, reply: string}>}
 */
export async function handleOllamaSkill(text = '', ctx = {}) {
  const trimmed = text.trim();

  // /ollama-modelos — lista modelos disponíveis
  if (/^-modelos?$/i.test(trimmed) || trimmed === '') {
    const health = await ollamaHealth();
    if (!health.ok) return { ok: false, reply: `Ollama indisponível: ${health.error}` };
    const list = health.models.length
      ? health.models.join('\n')
      : 'Nenhum modelo instalado. Use: ollama pull <nome>';
    return { ok: true, reply: `Modelos Ollama:\n${list}` };
  }

  // ollama pull <modelo>
  const pullMatch = trimmed.match(/^pull\s+(\S+)$/i);
  if (pullMatch) {
    if (PULL_REQUIRES_APPROVAL && !ctx.approvalGranted) {
      return {
        ok: false,
        needsApproval: true,
        reply: `Ollama pull "${pullMatch[1]}" requer aprovação.\nResponda sim, confirmar ou ok.`,
      };
    }
    // Pull com streaming resumido
    let lastStatus = '';
    try {
      for await (const chunk of ollamaPull(pullMatch[1])) {
        lastStatus = chunk.status || lastStatus;
      }
    } catch (err) {
      return { ok: false, reply: `Pull falhou: ${err.message}` };
    }
    return { ok: true, reply: `Pull concluído: ${pullMatch[1]} — ${lastStatus || 'ok'}` };
  }

  // /ollama modelo:<nome> <prompt>
  let model;
  let prompt = trimmed;
  const modelMatch = trimmed.match(/^modelo:(\S+)\s+([\s\S]+)$/i);
  if (modelMatch) {
    model = modelMatch[1];
    prompt = modelMatch[2];
  }

  if (!prompt) {
    return { ok: false, reply: 'Use: /ollama <prompt> ou /ollama-modelos' };
  }

  const result = await ollamaGenerate(prompt, { model });
  if (!result.ok) return { ok: false, reply: `Ollama: ${result.error}` };
  return { ok: true, reply: `🧠 Ollama (${result.model}):\n${result.reply}` };
}
