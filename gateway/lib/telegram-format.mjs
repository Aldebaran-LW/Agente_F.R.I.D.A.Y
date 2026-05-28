/**
 * Formata respostas Jarvis para Telegram (parse_mode HTML).
 * https://core.telegram.org/bots/api#html-style
 */

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatHelpMenu() {
  return [
    '<b>Jarvis</b> — Aldebaran-LW',
    '',
    'Comandos rápidos:',
    '• <code>status macofel</code>',
    '• <code>repos github</code>',
    '• <code>sites no ar</code>',
    '• <code>resumo portfolio</code>',
    '',
    'Ações com impacto pedem <b>sim</b>, <b>confirmar</b> ou <b>ok</b>.',
  ].join('\n');
}

export function formatApprovalBlock(preview = '') {
  const lines = [
    '⚠️ <b>Aprovação necessária</b>',
    '',
    'Esta ação altera produção ou dados. Responda:',
    '<b>sim</b> · <b>confirmar</b> · <b>ok</b>',
  ];
  if (preview) {
    lines.push('', `<i>${escapeHtml(preview.slice(0, 120))}</i>`);
  }
  return lines.join('\n');
}

function lineMacofel(data) {
  if (!data?.ok) return '• Macofel: <i>indisponível</i>';
  const p = data.pending_review ?? '?';
  const img = data.image_sync_pending ?? '?';
  const fail = data.image_sync_failed ?? '0';
  return `• <b>Macofel</b>: ${p} revisão · ${img} img pend. · ${fail} falha(s)`;
}

function lineGithub(data) {
  if (!data?.repos?.length) return '• GitHub: <i>sem dados</i>';
  const rows = data.repos
    .map((r) =>
      r.error
        ? `  ◦ ${escapeHtml(r.name)}: erro`
        : `  ◦ ${escapeHtml(r.name)}: ${r.open_issues} issues`
    )
    .join('\n');
  return `• <b>GitHub</b>\n${rows}`;
}

function lineDeploy(data) {
  if (!data?.sites?.length) return '• Sites: <i>sem dados</i>';
  const rows = data.sites
    .map((s) =>
      s.ok
        ? `  ◦ ${escapeHtml(s.site)}: ✅`
        : `  ◦ ${escapeHtml(s.site)}: ❌`
    )
    .join('\n');
  const head = data.ok ? '• <b>Sites</b>' : '• <b>Sites</b> ⚠️';
  return `${head}\n${rows}`;
}

export function formatPortfolioHtml(results = {}) {
  return [
    '<b>📋 Resumo portfolio</b>',
    '',
    lineMacofel(results['macofel-status']),
    '',
    lineGithub(results['github-aldebaran']),
    '',
    lineDeploy(results['deploy-monitor']),
  ].join('\n');
}

export function formatSingleReply(route, payload, { approvalBlocked = false } = {}) {
  if (approvalBlocked) {
    return formatApprovalBlock(route?.intent);
  }
  if (route?.skill === 'help') {
    return formatHelpMenu();
  }
  if (route?.agent === 'macofel' && payload?.ok) {
    return [
      '<b>Macofel</b>',
      lineMacofel(payload).replace('• ', ''),
      `<i>fonte: ${escapeHtml(payload.source || 'gateway')}</i>`,
    ].join('\n');
  }
  if (route?.skill === 'github-aldebaran' && payload?.repos) {
    return ['<b>GitHub</b>', lineGithub(payload).replace('• <b>GitHub</b>\n', '')].join(
      '\n'
    );
  }
  if (route?.skill === 'deploy-monitor' && payload?.sites) {
    return lineDeploy(payload);
  }
  return escapeHtml(
    'Não entendi. Tente: status macofel · repos github · resumo portfolio'
  );
}

export function formatWorkflowHtml({
  workflowId,
  results = {},
  approvalBlocked = false,
}) {
  if (workflowId === 'portfolio-status') {
    return formatPortfolioHtml(results);
  }
  if (approvalBlocked && workflowId === 'macofel-sync') {
    const pre = formatSingleReply(
      { agent: 'macofel', skill: 'macofel-status' },
      results['macofel-status']
    );
    return `${pre}\n\n${formatApprovalBlock('sync de imagens')}`;
  }
  return formatPortfolioHtml(results);
}

/** Plain text reply → HTML quando ainda não há estrutura rica. */
export function plainToTelegramHtml(plain) {
  return escapeHtml(plain).replace(/\n/g, '\n');
}

export function buildTelegramPayload({
  plan,
  route,
  payload,
  results,
  approvalBlocked,
  plainReply,
}) {
  let html;
  if (plan?.kind === 'workflow') {
    html = formatWorkflowHtml({
      workflowId: plan.workflowId,
      results: results ?? {},
      approvalBlocked,
    });
  } else {
    html = formatSingleReply(route, payload, { approvalBlocked });
  }
  if (!html && plainReply) {
    html = plainToTelegramHtml(plainReply);
  }
  return {
    text: plainReply,
    telegram_html: html,
    parse_mode: 'HTML',
  };
}
