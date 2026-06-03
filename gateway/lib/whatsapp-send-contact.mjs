import {
  handleSendContactCommand,
  loadPending,
} from './repo-scripts/scheduled-whatsapp-core.mjs';

export async function tryConfirmContactPending(message = '') {
  const text = String(message).trim();
  if (!/^(sim|confirmar|ok)\b/i.test(text) || text.length >= 48) {
    return { handled: false };
  }
  const pending = loadPending();
  if (!pending?.contactId && !pending?.to) return { handled: false };
  const result = await handleSendContactCommand(message);
  return { handled: true, ...result };
}

export async function runWhatsAppSendContact({ message = '' } = {}) {
  const result = await handleSendContactCommand(message);
  if (result.error === 'comando_nao_reconhecido') {
    return { ok: false, error: 'comando invalido' };
  }
  return {
    ok: result.ok !== false,
    reply: result.reply,
    needsApproval: result.needsApproval,
    preview: result.preview,
    item: result.item,
    error: result.error,
  };
}
