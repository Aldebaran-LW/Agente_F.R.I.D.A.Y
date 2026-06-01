import {
  auditText,
  auditResearchUrl,
  formatAuditTelegram,
} from './repo-scripts/veldora-audit-core.mjs';

/**
 * Executor gateway — skill security-audit (rápido, sem HF).
 * @param {{ message?: string, url?: string }} [opts]
 */
export async function runSecurityAudit(opts = {}) {
  const message = opts.message?.trim();
  const url = opts.url?.trim();

  if (url) {
    const u = auditResearchUrl(url);
    const result = {
      ok: u.ok,
      veredito: u.ok ? 'aprovado' : 'bloqueado',
      checks: [
        {
          id: 'fonte-url',
          status: u.ok ? 'ok' : 'falha',
          mensagem: u.ok ? `${u.tier} — ${u.host}` : u.reason || 'rejeitada',
        },
      ],
      recomendacao: u.ok
        ? 'URL aceite.'
        : 'URL fora da allowlist (sources-allowlist.txt).',
      source: 'veldora-audit',
      reply: null,
    };
    result.reply = formatAuditTelegram(result);
    return result;
  }

  if (!message) {
    return {
      ok: false,
      error: 'mensagem vazia',
      hint: 'envie texto ou: verificar fonte https://github.com/...',
    };
  }

  if (!url) {
    const fromText = message.match(/https?:\/\/[^\s<>"')\]]+/i)?.[0];
    if (fromText) {
      return runSecurityAudit({ url: fromText });
    }
  }

  const result = auditText(message, { context: 'gateway' });
  result.reply = formatAuditTelegram(result);
  return result;
}
