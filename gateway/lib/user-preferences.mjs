import { handlePreferenceCommand } from './repo-scripts/preferences-memory.mjs';

export async function runUserPreferences({ message = '' } = {}) {
  const result = await handlePreferenceCommand(message);
  if (result.error === 'comando_nao_reconhecido') {
    return { ok: false, error: 'comando invalido' };
  }
  return {
    ok: result.ok !== false,
    reply: result.reply,
    error: result.error,
  };
}
