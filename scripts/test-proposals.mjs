#!/usr/bin/env node
import { handleProposalCommand } from './hf/proposal-approval.mjs';

const gen = await handleProposalCommand('gerar proposta manutenção repo teste');
console.log('[generate]', gen.ok, gen.proposal?.id);

const list = await handleProposalCommand('propostas');
console.log('[list]', list.ok, list.proposals?.length);

if (gen.proposal?.id) {
  const appr = await handleProposalCommand(`aprovar proposta ${gen.proposal.id}`);
  console.log('[approve]', appr.ok, appr.reply?.slice(0, 80));
}
