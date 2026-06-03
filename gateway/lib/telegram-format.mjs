/**
 * Formata respostas Jarvis para Telegram (parse_mode HTML).
 * https://core.telegram.org/bots/api#html-style
 */
import { pickReplyMarkup } from './telegram-keyboards.mjs';

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function extractOrchestrateText(payload) {
  if (!payload) return '';
  const inner = payload.data ?? payload;
  const text =
    payload.reply ??
    inner?.reply ??
    inner?.result ??
    inner?.message ??
    (typeof inner === 'string' ? inner : '');
  return String(text).slice(0, 1200);
}

export function formatHelpMenu() {
  return [
    '<b>Jarvis</b> — Aldebaran-LW',
    '',
    '<b>Operação</b>',
    '• <code>/status</code> Macofel · <code>/office</code> agentes',
    '• <code>repos github</code> · <code>sites no ar</code> · <code>resumo portfolio</code>',
    '• <code>/quotas</code> consumo LLM (Rimuru)',
    '',
    '<b>Inovação</b> (HF)',
    '• <code>previsão de vendas</code> (Yato→Gideon)',
    '• <code>pesquisa mercado</code> (Yato)',
    '• <code>viabilidade</code> (Gideon) · <code>design rebeca</code>',
    '• <code>propostas</code> · <code>gerar proposta manutenção</code>',
    '',
    '<b>Suporte</b>',
    '• <code>tokens openrouter</code> (Rimuru)',
    '• <code>auditoria seguranca</code> (Veldora)',
    '',
    '<b>WhatsApp</b> (lembretes Twilio)',
    '• <code>agendar whatsapp: DD/MM/AAAA HH:MM — texto</code> (para ti)',
    '• <code>enviar joao "mensagem" amanhã 19h</code> (contacto)',
    '• <code>contato adicionar joao +5511… amigo</code>',
    '• <code>preferencia listar</code> · quiet hours',
    '• Atalhos: botão <b>📱 WhatsApp</b> abaixo',
    '',
    'Escrita (sync, build) pede <b>sim</b> · <b>confirmar</b> · <b>ok</b>.',
  ].join('\n');
}

export function formatScheduleWhatsAppHtml(payload = {}, { approvalBlocked = false } = {}) {
  if (approvalBlocked || payload?.needsApproval) {
    const when = payload?.preview?.formatted || '';
    const body = payload?.preview?.body || payload?.reply || '';
    return [
      '<b>📱 Lembrete WhatsApp</b>',
      when ? `🕐 ${escapeHtml(when)}` : '',
      '',
      escapeHtml(String(body).slice(0, 400)),
      '',
      '⚠️ Confirma com os botões abaixo ou responde <b>sim</b>.',
      'Imagem FRIDAY incluída se configurada no servidor.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (payload?.item?.id) {
    const who = payload.item.contactName || payload.item.contactId;
    return [
      '<b>✅ Agendado</b>',
      who ? `👤 ${escapeHtml(who)}` : '',
      `🕐 ${escapeHtml(formatSpShort(payload.item.sendAt))}`,
      `📝 ${escapeHtml(payload.item.body.slice(0, 200))}`,
      `<code>${escapeHtml(payload.item.id)}</code>`,
      '',
      '<i>Envio automático no WhatsApp no horário marcado.</i>',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (payload?.preview?.contact) {
    return [
      '<b>📱 WhatsApp → contacto</b>',
      `👤 ${escapeHtml(payload.preview.contact)}`,
      payload.preview.formatted ? `🕐 ${escapeHtml(payload.preview.formatted)}` : '',
      '',
      escapeHtml(String(payload.preview.body || '').slice(0, 400)),
      '',
      '⚠️ Confirma com <b>sim</b> (30 min).',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (payload?.reply) {
    return escapeHtml(payload.reply).replace(/\n/g, '\n');
  }
  return null;
}

function formatSpShort(iso) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
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

export function formatAgentsStatusHtml(results = {}) {
  const flow = results['ecosystem-watch'];
  const lines = ['<b>🤖 Situação dos agentes</b>', ''];
  if (flow?.reply) {
    lines.push(escapeHtml(flow.reply).replace(/\n/g, '\n'));
  } else if (flow?.operational?.length) {
    for (const a of flow.operational) {
      const st = a.state === 'working' ? '🔄' : a.state === 'error' ? '❌' : '✅';
      lines.push(`${st} <b>${escapeHtml(a.id)}</b>${a.skill ? ` · ${escapeHtml(a.skill)}` : ''}`);
    }
  } else {
    lines.push('<i>Heimdall: sem snapshot Hub (EC2/heartbeat).</i>');
  }
  lines.push('', lineDeploy(results['deploy-monitor']), '', lineGithub(results['github-aldebaran']));
  return lines.join('\n');
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
  if (route?.skill === 'schedule-whatsapp' || route?.skill === 'whatsapp-send-contact') {
    const html = formatScheduleWhatsAppHtml(payload, { approvalBlocked });
    if (html) return html;
  }
  if (route?.skill === 'whatsapp-contacts' && payload?.reply) {
    return escapeHtml(payload.reply).replace(/\n/g, '\n');
  }
  if (route?.skill === 'proposals-pipeline' && payload?.reply) {
    const raw = String(payload.reply);
    if (raw.includes('<b>')) {
      return raw.replace(/\n/g, '\n');
    }
    return escapeHtml(raw).replace(/\n/g, '\n');
  }
  if (route?.skill === 'user-preferences' && payload?.reply) {
    return escapeHtml(String(payload.reply)).replace(/\n/g, '\n');
  }
  if (
    (route?.skill === 'innovation-monitor' ||
      route?.skill === 'ecosystem-watch' ||
      route?.skill === 'innovation-design' ||
      route?.skill === 'security-audit') &&
    payload?.reply
  ) {
    return escapeHtml(String(payload.reply)).replace(/\n/g, '\n');
  }
  if (route?.skill === 'clarify') {
    return null;
  }
  if (payload?.reply) {
    return escapeHtml(String(payload.reply)).replace(/\n/g, '\n');
  }
  return null;
}

export function formatWorkflowHtml({
  workflowId,
  results = {},
  approvalBlocked = false,
}) {
  if (workflowId === 'portfolio-status') {
    return formatPortfolioHtml(results);
  }
  if (workflowId === 'agents-status') {
    return formatAgentsStatusHtml(results);
  }
  if (workflowId === 'vendas-previsao') {
    const yato = results['innovation-market'];
    const gideon = results['innovation-forecast'];
    const lines = [];
    if (yato?.reply || yato?.data?.reply || yato?.data?.result) {
      lines.push('<b>Yato · mercado</b>', escapeHtml(extractOrchestrateText(yato)));
    }
    if (gideon?.reply || gideon?.data?.reply || gideon?.data?.result) {
      lines.push('', '<b>Gideon · previsão</b>', escapeHtml(extractOrchestrateText(gideon)));
    }
    return lines.length
      ? lines.join('\n')
      : '<i>Previsão de vendas: HF/EC2 sem resposta.</i>';
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

  const reply_markup = pickReplyMarkup({
    route,
    payload,
    approvalBlocked,
    plainReply,
  });

  return {
    text: plainReply,
    telegram_html: html,
    parse_mode: 'HTML',
    ...(reply_markup ? { reply_markup } : {}),
  };
}
