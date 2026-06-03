/**
 * Fila de propostas: pending → approved / rejected.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeProposedAction } from '../github/executor.mjs';
import { recordOutcome } from '../lib/preferences-memory.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = join(__dirname, '..', '..');

function proposalsDataRoot() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) return '/tmp/openclaw';
  return join(WORKSPACE_ROOT, 'data');
}

function filePending() {
  return join(proposalsDataRoot(), 'proposals-pending.json');
}
function fileApproved() {
  return join(proposalsDataRoot(), 'proposals-approved.json');
}
function fileRejected() {
  return join(proposalsDataRoot(), 'proposals-rejected.json');
}

function loadStore(path, key) {
  if (!existsSync(path)) return { version: 1, [key]: [] };
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return { version: 1, [key]: Array.isArray(raw[key]) ? raw[key] : [] };
  } catch {
    return { version: 1, [key]: [] };
  }
}

function saveStore(path, key, items) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ version: 1, [key]: items }, null, 2), 'utf8');
}

export function saveProposal(proposal) {
  const path = filePending();
  const store = loadStore(path, 'proposals');
  if (store.proposals.some((p) => p.id === proposal.id)) {
    return { ok: false, error: 'Proposta já existe' };
  }
  store.proposals.push({ ...proposal, status: 'pending' });
  saveStore(path, 'proposals', store.proposals);
  return { ok: true, proposal };
}

export function listPending() {
  const store = loadStore(filePending(), 'proposals');
  return store.proposals.filter((p) => p.status === 'pending');
}

export function getProposal(id) {
  const store = loadStore(filePending(), 'proposals');
  return store.proposals.find((p) => p.id === id || p.id.startsWith(id)) || null;
}

export async function approveProposal(id) {
  const path = filePending();
  const store = loadStore(path, 'proposals');
  const idx = store.proposals.findIndex((p) => p.id === id || p.id.startsWith(id));
  if (idx < 0) return { ok: false, error: `Proposta não encontrada: ${id}` };

  const proposal = store.proposals.splice(idx, 1)[0];
  proposal.status = 'approved';
  proposal.approvedAt = new Date().toISOString();

  const gh = await executeProposedAction(proposal);
  proposal.githubResult = gh;

  const approved = loadStore(fileApproved(), 'proposals');
  approved.proposals.push(proposal);
  saveStore(fileApproved(), 'proposals', approved.proposals);
  saveStore(path, 'proposals', store.proposals);

  recordOutcome('proposal', 'accepted', { id: proposal.id, type: proposal.type });

  return { ok: true, proposal, github: gh };
}

export function rejectProposal(id, reason = '') {
  const path = filePending();
  const store = loadStore(path, 'proposals');
  const idx = store.proposals.findIndex((p) => p.id === id || p.id.startsWith(id));
  if (idx < 0) return { ok: false, error: `Proposta não encontrada: ${id}` };

  const proposal = store.proposals.splice(idx, 1)[0];
  proposal.status = 'rejected';
  proposal.rejectedAt = new Date().toISOString();
  proposal.rejectReason = String(reason || '').trim() || 'sem motivo';

  const rejected = loadStore(fileRejected(), 'proposals');
  rejected.proposals.push(proposal);
  saveStore(fileRejected(), 'proposals', rejected.proposals);
  saveStore(path, 'proposals', store.proposals);

  recordOutcome('proposal', 'rejected', { id: proposal.id, reason: proposal.rejectReason });

  return { ok: true, proposal };
}

export function parseProposalCommand(message = '') {
  const text = String(message).trim();

  if (/^propostas$/i.test(text) || /^lista\s+propostas$/i.test(text) || /^\/propostas$/i.test(text)) {
    return { action: 'list' };
  }

  const gen = text.match(/^gerar\s+proposta\s+(\S+)(?:\s+(.+))?$/iu);
  if (gen) {
    const type = gen[1].normalize('NFD').replace(/\p{M}/gu, '');
    return {
      action: 'generate',
      type,
      context: { detail: gen[2]?.trim(), repo: 'Agente_OpenClaw' },
    };
  }

  const appr = text.match(/^aprovar\s+proposta\s+(\S+)/i);
  if (appr) return { action: 'approve', id: appr[1] };

  const rej = text.match(/^rejeitar\s+proposta\s+(\S+)(?:\s+(.+))?$/i);
  if (rej) return { action: 'reject', id: rej[1], reason: rej[2]?.trim() };

  return null;
}

export async function handleProposalCommand(message) {
  const parsed = parseProposalCommand(message);
  if (!parsed) return { ok: false, error: 'comando_nao_reconhecido' };

  if (parsed.action === 'list') {
    const items = listPending();
    if (!items.length) {
      return { ok: true, reply: 'Nenhuma proposta pendente. Gera uma: gerar proposta manutenção', proposals: [] };
    }
    const lines = items.map(
      (p) =>
        `• <b>${p.id}</b> [${p.type}] ${p.title}\n  ${p.effort}/${p.risk} — ${p.description.slice(0, 80)}…`
    );
    return {
      ok: true,
      reply: `Propostas pendentes (${items.length}):\n\n${lines.join('\n\n')}`,
      proposals: items,
    };
  }

  if (parsed.action === 'generate') {
    const { generateProposal } = await import('./proposal-generator.mjs');
    const proposal = generateProposal(parsed.type, parsed.context);
    const saved = saveProposal(proposal);
    if (!saved.ok) return { ok: false, reply: saved.error };
    return {
      ok: true,
      reply: [
        `Proposta criada: ${proposal.id}`,
        `[${proposal.type}] ${proposal.title}`,
        proposal.description,
        `Esforço: ${proposal.effort} · Risco: ${proposal.risk}`,
        '',
        'Aprovar: aprovar proposta ' + proposal.id,
        'Rejeitar: rejeitar proposta ' + proposal.id + ' motivo',
        'Lista: propostas',
      ].join('\n'),
      proposal,
    };
  }

  if (parsed.action === 'approve') {
    const r = await approveProposal(parsed.id);
    if (!r.ok) return { ok: false, reply: r.error };
    const sim = r.github?.simulated ? ' (GitHub simulado — console)' : '';
    return {
      ok: true,
      reply: `Aprovada ${r.proposal.id}${sim}. ${r.github?.issueUrl || ''}`,
      proposal: r.proposal,
    };
  }

  if (parsed.action === 'reject') {
    const r = rejectProposal(parsed.id, parsed.reason);
    if (!r.ok) return { ok: false, reply: r.error };
    return { ok: true, reply: `Rejeitada ${r.proposal.id}. Motivo: ${r.proposal.rejectReason}` };
  }

  return { ok: false, error: 'acao_desconhecida' };
}
