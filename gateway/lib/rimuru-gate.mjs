/**
 * Rimuru gate — bloqueia rotas que consomem LLM quando cota local ≥ block_usage_pct.
 * Sem LLM; lê snapshot + token-policy.json.
 */
import {
  createTokenManager,
  loadMonitorSnapshot,
  loadTokenPolicy,
} from './repo-scripts/rimuru-token-core.mjs';

/** Skills que delegam para HF/EC2 com LLM (não scripts read-only). */
export const LLM_SKILLS = new Set([
  'innovation-knowledge',
  'innovation-market',
  'innovation-analysis',
  'innovation-forecast',
  'innovation-research',
  'innovation-viability',
  'innovation-build',
  'cursor-cloud-agent',
]);

export function isLlmSkill(skill) {
  return LLM_SKILLS.has(String(skill || ''));
}

function evaluateQuota(opts = {}) {
  if (process.env.RIMURU_GATE_DISABLED === '1') {
    return { allowed: true, level: 'ok', gated: false, bypass: true };
  }
  const policy = loadTokenPolicy();
  const snapshot = loadMonitorSnapshot();
  const used = Number(snapshot?.estimated_tokens_today) || 0;
  const manager = createTokenManager({ usedTokens: used });
  const pending = Number(opts.estimatedTokens) || 0;
  const st = manager.status();
  const blockPct = policy.block_usage_pct || 95;
  const warnPct = policy.warn_usage_pct || 80;
  const wouldBlock =
    !manager.canUse(pending || 1) || st.level === 'block' || st.usagePct >= blockPct;
  if (wouldBlock) {
    return {
      allowed: false,
      level: 'block',
      gated: true,
      status: st,
      reason: `cota diária local ≥${blockPct}%`,
      prefer_order: policy.prefer_order,
    };
  }
  return {
    allowed: true,
    level: st.usagePct >= warnPct ? 'warn' : 'ok',
    gated: true,
    status: st,
    prefer_order: policy.prefer_order,
  };
}

/** Gate genérico para forward HF/EC2 (orchestrate). */
export function checkLlmQuota(opts = {}) {
  return evaluateQuota(opts);
}

/**
 * @param {string} skill
 * @param {{ estimatedTokens?: number }} [opts]
 */
export function checkRimuruGate(skill, opts = {}) {
  if (!isLlmSkill(skill)) {
    return { allowed: true, level: 'ok', skill, gated: false };
  }
  const base = evaluateQuota(opts);
  return { ...base, skill, gated: base.gated !== false };
}

export function formatGateBlockReply(gate) {
  const st = gate.status || {};
  const remaining = st.remaining != null ? st.remaining.toLocaleString('pt-PT') : '?';
  const limit = st.limit != null ? st.limit.toLocaleString('pt-PT') : '?';
  return [
    `Rimuru [bloqueio ${st.usagePct ?? '?'}%]: ${gate.reason || 'cota esgotada'}.`,
    `Restam ~${remaining} / ${limit} tokens locais hoje.`,
    'Use scripts, gateway read-only ou Ollama na EC2 até reset.',
    'Consulta: rimuru status ou /quotas.',
  ].join('\n');
}
