/**
 * HITL durável para propostas (padrão ADK — pausa → aprovação → resume).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

export const PENDING_STATUSES = new Set(['pending', 'awaiting_approval']);

export function isPendingStatus(status) {
  return PENDING_STATUSES.has(status);
}

export function buildInnovationHitl(proposal) {
  const id = proposal.id || `prop_${Date.now()}`;
  return {
    interrupt_id: id,
    workflow_id: 'innovation-pipeline',
    stage: 'post-gideon',
    paused_at: new Date().toISOString(),
    resume_agent: 'hefestos',
    resume_skill: 'innovation-build',
    resumed: false,
  };
}

export function enrichInnovationProposal(proposal) {
  return {
    ...proposal,
    status: 'awaiting_approval',
    hitl: buildInnovationHitl(proposal),
  };
}

function hitlResumePath(dataRoot = null) {
  const root = dataRoot || resolve(repoRoot, 'data');
  return join(root, 'innovation', 'hitl-resume.json');
}

/**
 * Regista resume após aprovação humana (fila para Hefestos / Cursor).
 */
export function enqueueHitlResume(proposal, { dataRoot = null } = {}) {
  const hitl = proposal?.hitl;
  if (!hitl || hitl.resumed) {
    return { ok: true, skipped: true, reason: hitl ? 'already_resumed' : 'no_hitl' };
  }

  const entry = {
    interrupt_id: hitl.interrupt_id,
    workflow_id: hitl.workflow_id,
    stage: hitl.stage,
    proposal_id: proposal.id,
    resumed_at: new Date().toISOString(),
    next: {
      agent: hitl.resume_agent || 'hefestos',
      skill: hitl.resume_skill || 'innovation-build',
      manual: true,
      hint: 'Skill openclaw-feature-dev no Cursor com contexto da proposta aprovada',
    },
    context: proposal.context || {},
    title: proposal.title,
  };

  const path = hitlResumePath(dataRoot);
  mkdirSync(dirname(path), { recursive: true });
  let queue = { version: 1, items: [] };
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      queue.items = Array.isArray(raw.items) ? raw.items : [];
    } catch {
      queue.items = [];
    }
  }
  queue.items.push(entry);
  writeFileSync(path, JSON.stringify(queue, null, 2), 'utf8');

  return { ok: true, entry, path };
}

export function formatResumeReply(proposal, resume) {
  if (resume?.skipped) {
    return '';
  }
  const next = resume?.entry?.next;
  if (!next) return '';
  return `\nPróximo: ${next.agent} (${next.skill}) — ${next.hint}`;
}
