import { handleContactCommand } from './repo-scripts/whatsapp-contacts.mjs';

export async function runWhatsAppContacts({ message = '' } = {}) {
  const result = await handleContactCommand(message);
  if (result.error === 'comando_nao_reconhecido') {
    return { ok: false, error: 'comando invalido' };
  }
  return {
    ok: result.ok !== false,
    reply: result.reply,
    error: result.error,
  };
}
