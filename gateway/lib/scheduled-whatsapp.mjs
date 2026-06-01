import {
  handleScheduleCommand,
  loadPending,
} from './repo-scripts/scheduled-whatsapp-core.mjs';

/** Confirma lembrete pendente quando o utilizador responde só "sim". */
export async function tryConfirmPendingOnly(message = '') {
  const text = String(message).trim();
  if (!/^(sim|confirmar|ok)\b/i.test(text) || text.length >= 48) {
    return { handled: false };
  }
  if (!loadPending()) return { handled: false };
  const result = await handleScheduleCommand(message);
  return { handled: true, ...result };
}

export async function runScheduledWhatsApp({ message = '' } = {}) {
  const result = await handleScheduleCommand(message);
  if (result.error === 'comando_nao_reconhecido') {
    return { ok: false, error: 'comando invalido' };
  }
  return {
    ok: result.ok !== false,
    reply: result.reply,
    needsApproval: result.needsApproval,
    preview: result.preview,
    item: result.item,
  };
}
