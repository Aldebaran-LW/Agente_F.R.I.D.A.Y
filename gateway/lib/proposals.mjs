import { handleProposalCommand } from './repo-scripts/proposal-approval.mjs';

export async function runProposals({ message = '' } = {}) {
  const result = await handleProposalCommand(message);
  if (result.error === 'comando_nao_reconhecido') {
    return { ok: false, error: 'comando invalido' };
  }
  return {
    ok: result.ok !== false,
    reply: result.reply,
    proposals: result.proposals,
    proposal: result.proposal,
    error: result.error,
  };
}
