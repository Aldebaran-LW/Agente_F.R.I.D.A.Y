/**
 * Notificações Fase C — pipeline inovação → proposta → Telegram.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { sendTelegramHtml, getTelegramConfig, loadEnv } from './telegram-jarvis-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');

function proposalsPath() {
  return resolve(root, 'data', 'proposals-pending.json');
}

function loadPending() {
  const p = proposalsPath();
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    return Array.isArray(raw.proposals) ? raw.proposals : [];
  } catch {
    return [];
  }
}

function savePending(items) {
  const p = proposalsPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ version: 1, proposals: items }, null, 2), 'utf8');
}

/**
 * @param {object} gideon — saída gideon-predict
 */
export function proposalFromGideon(gideon) {
  const id = `prop_gideon_${gideon.gideon_id || Date.now().toString(36)}_${randomBytes(2).toString('hex')}`;
  const topico = gideon.topico || 'openclaw';
  const score = gideon.confianca_score ?? gideon.viabilidade_score ?? 0;
  const sinais = (gideon.sinais || []).slice(0, 3).join('; ') || 'sem sinais';
  return {
    id,
    type: 'innovation',
    title: `Gideon ${score}% — ${topico}`,
    description: [
      gideon.justificativa || '',
      `Sinais: ${sinais}`,
      gideon.proximo_passo ? `Próximo: ${gideon.proximo_passo}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    effort: score >= 85 ? 'high' : 'medium',
    risk: 'medium',
    proposedAction: 'hf_pipeline_then_github',
    context: {
      source: 'innovation-cron',
      gideon_id: gideon.gideon_id,
      topico,
      confianca_score: score,
      recomendacao: gideon.recomendacao,
      saved_json: gideon.saved_json,
    },
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
}

export function registerGideonProposal(gideon) {
  const proposal = proposalFromGideon(gideon);
  const pending = loadPending();
  const dup = pending.find(
    (p) =>
      p.context?.gideon_id &&
      p.context.gideon_id === gideon.gideon_id &&
      p.status === 'pending',
  );
  if (dup) return { ok: true, proposal: dup, duplicate: true };
  pending.push(proposal);
  savePending(pending);
  return { ok: true, proposal, duplicate: false };
}

export function formatInnovationTelegram({ gideon, proposal }) {
  const score = gideon.confianca_score ?? '?';
  const topico = gideon.topico || 'openclaw';
  const cenario = gideon.cenarios?.[0]?.descricao?.slice(0, 200) || '—';
  const lines = [
    '<b>🧠 Inovação — candidato Hefestos</b>',
    '',
    `<b>Tópico:</b> ${escapeHtml(topico)}`,
    `<b>Score Gideon:</b> ${score}/100`,
    `<b>Cenário:</b> ${escapeHtml(cenario)}`,
    '',
    `<b>Proposta:</b> <code>${proposal.id}</code>`,
    '',
    '⚠️ <b>Não constrói sozinho.</b>',
    '• <code>aprovar proposta ' + proposal.id + '</code>',
    '• <code>rejeitar proposta ' + proposal.id + ' motivo</code>',
    '• <code>propostas</code> — lista pendente',
  ];
  return lines.join('\n');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {{ gideon: object, dryRun?: boolean }} opts
 */
export async function notifyGideonCandidate(opts) {
  loadEnv(resolve(root, '.env'));
  const { gideon, dryRun = false } = opts;
  const reg = registerGideonProposal(gideon);
  const html = formatInnovationTelegram({ gideon, proposal: reg.proposal });

  if (dryRun) {
    console.log('[dry-run] Telegram inovação:\n', html.replace(/<[^>]+>/g, ''));
    return { ok: true, dryRun: true, proposal: reg.proposal, duplicate: reg.duplicate };
  }

  const cfg = getTelegramConfig();
  if (!cfg.ok || !cfg.adminChatId) {
    return {
      ok: false,
      error: cfg.error || 'TELEGRAM_ADMIN_CHAT_ID ausente',
      proposal: reg.proposal,
    };
  }

  const sent = await sendTelegramHtml(
    cfg.adminChatId,
    { html, plainFallback: html.replace(/<[^>]+>/g, '') },
    cfg,
  );
  return {
    ok: sent.ok,
    proposal: reg.proposal,
    duplicate: reg.duplicate,
    telegram: sent,
  };
}
