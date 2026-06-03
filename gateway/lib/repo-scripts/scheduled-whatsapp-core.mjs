/**
 * WhatsApp via Twilio — lembretes para admin (TWILIO_WHATSAPP_TO) ou contactos (campo to no job).
 */
import {
  parseSendContactCommand,
  resolveContact,
} from './whatsapp-contacts.mjs';
import { quietHoursWarningForSendAt } from './preferences-memory.mjs';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_ROOT = join(__dirname, '..', '..');
export const DEFAULT_QUEUE_FILE = join(WORKSPACE_ROOT, 'data', 'scheduled-whatsapp.json');
export const DEFAULT_PENDING_FILE = join(
  WORKSPACE_ROOT,
  'data',
  'scheduled-whatsapp-pending.json'
);

const TZ_OFFSET = '-03:00'; // America/Sao_Paulo (sem horário de verão)

export function getTwilioConfig({ requireDefaultTo = true } = {}) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = normalizeWhatsApp(process.env.TWILIO_WHATSAPP_FROM?.trim());
  const to = normalizeWhatsApp(process.env.TWILIO_WHATSAPP_TO?.trim());
  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      error:
        'Twilio incompleto: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM no .env',
    };
  }
  if (requireDefaultTo && !to) {
    return {
      ok: false,
      error: 'TWILIO_WHATSAPP_TO em falta (lembretes para ti). Para contactos, define to no agendamento.',
    };
  }
  return {
    ok: true,
    accountSid,
    authToken,
    from,
    to: to || '',
    bodyStyle: process.env.TWILIO_WHATSAPP_BODY_STYLE?.trim() || 'card',
    brand: process.env.TWILIO_WHATSAPP_BRAND?.trim() || 'FRIDAY',
    footer: process.env.TWILIO_WHATSAPP_FOOTER?.trim() || 'OpenClaw · Aldebaran-LW',
    defaultMediaUrl: process.env.TWILIO_WHATSAPP_DEFAULT_MEDIA_URL?.trim() || '',
    useTemplate: envBool('TWILIO_WHATSAPP_USE_TEMPLATE', false),
    contentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID?.trim() || '',
  };
}

function envBool(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

/** Separa texto do lembrete e imagem opcional (`| img: https://...`). */
export function parseMessageExtras(text = '') {
  let body = String(text).trim();
  let mediaUrl = '';
  const imgMatch = body.match(/\s*\|\s*(?:img|imagem)\s*:\s*(https?:\/\/\S+)/i);
  if (imgMatch) {
    mediaUrl = imgMatch[1].replace(/[)\]}>]+$/, '');
    body = body.slice(0, imgMatch.index).trim();
  }
  return { body, mediaUrl };
}

/**
 * Corpo final enviado ao WhatsApp (texto; imagem vai em MediaUrl à parte).
 */
export function formatOutboundBody({ text, sendAtIso }, config = getTwilioConfig()) {
  const msg = String(text).trim();
  const when = sendAtIso ? formatSp(sendAtIso) : '';
  if (!config.ok) return `[FRIDAY] ${msg}`;

  if (config.bodyStyle === 'plain') {
    return when ? `${config.brand}: ${msg} (${when})` : `${config.brand}: ${msg}`;
  }

  const lines = [`${config.brand} · Lembrete`, '----------------'];
  if (when) lines.push(when, '');
  lines.push(msg);
  if (config.footer) lines.push('', `— ${config.footer}`);
  return lines.join('\n');
}

function buildContentVariables({ text, sendAtIso }) {
  const when = sendAtIso ? formatSp(sendAtIso) : '';
  const [datePart, timePart] = when.includes(',')
    ? when.split(',').map((s) => s.trim())
    : [when, ''];
  return {
    1: datePart || when,
    2: timePart || '',
    3: String(text).trim(),
  };
}

export function normalizeWhatsApp(value) {
  if (!value) return '';
  const v = String(value).trim();
  if (v.startsWith('whatsapp:')) return v;
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  return `whatsapp:+${digits}`;
}

function nowInSaoPaulo() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function toUtcDate(y, m, d, h, min) {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00${TZ_OFFSET}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysSp({ year, month, day }, days) {
  const base = toUtcDate(year, month, day, 12, 0);
  if (!base) return null;
  base.setUTCDate(base.getUTCDate() + days);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(base).map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

/**
 * Extrai data/hora + corpo da mensagem a partir do resto do comando.
 * @returns {{ sendAt: Date, body: string } | { error: string }}
 */
export function parseDateTimeAndBody(rest) {
  let text = String(rest || '').trim();
  if (!text) return { error: 'Indica data, hora e mensagem. Ex.: 05/06/2026 14:30 — Revisar catálogo' };

  text = text.replace(/^sim\s*[:\-—]\s*/i, '');

  const separators = /\s+[—\-|:]\s+/;
  const sp = nowInSaoPaulo();

  const patterns = [
    {
      re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?:\s+[—\-|:]\s+|\s+)(.+)$/is,
      fn: (m) => toUtcDate(+m[3], +m[2], +m[1], +m[4], +m[5]),
      bodyIdx: 6,
    },
    {
      re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/i,
      fn: (m) => toUtcDate(+m[3], +m[2], +m[1], +m[4], +m[5]),
      bodyIdx: null,
    },
    {
      re: /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?:\s+[—\-|:]\s+|\s+)(.+)$/is,
      fn: (m) => toUtcDate(sp.year, +m[2], +m[1], +m[3], +m[4]),
      bodyIdx: 5,
    },
    {
      re: /^amanh[ãa]\s+(\d{1,2}):(\d{2})(?:\s+[—\-|:]\s+|\s+)(.+)$/is,
      fn: (m) => {
        const d = addDaysSp(sp, 1);
        return d ? toUtcDate(d.year, d.month, d.day, +m[1], +m[2]) : null;
      },
      bodyIdx: 3,
    },
    {
      re: /^hoje\s+(\d{1,2}):(\d{2})(?:\s+[—\-|:]\s+|\s+)(.+)$/is,
      fn: (m) => toUtcDate(sp.year, sp.month, sp.day, +m[1], +m[2]),
      bodyIdx: 3,
    },
  ];

  for (const { re, fn, bodyIdx } of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const sendAt = fn(m);
    if (!sendAt) return { error: 'Data ou hora inválida.' };
    let body = bodyIdx ? m[bodyIdx]?.trim() : '';
    if (!body) {
      const split = text.split(separators);
      if (split.length >= 2) body = split.slice(1).join(' — ').trim();
    }
    if (!body) return { error: 'Falta o texto da mensagem após data e hora.' };
    const extras = parseMessageExtras(body);
    return { sendAt, body: extras.body, mediaUrl: extras.mediaUrl };
  }

  const split = text.split(separators);
  if (split.length >= 2) {
    const head = split[0].trim();
    const body = split.slice(1).join(' — ').trim();
    const inner = parseDateTimeAndBody(`${head} — ${body}`);
    if (inner.sendAt) return inner;
  }

  return {
    error:
      'Formato: agendar whatsapp: DD/MM/AAAA HH:MM — sua mensagem (ou amanhã 9:00 — texto)',
  };
}

export function parseUserCommand(message = '') {
  const text = String(message).trim();
  const lower = text.toLowerCase();

  if (/^(lista|listar|meus)\s+(agendamentos?\s+)?whatsapp/i.test(text)) {
    return { action: 'list' };
  }

  const cancel = text.match(/^cancelar\s+(?:agendamento\s+)?whatsapp\s+(\S+)/i);
  if (cancel) return { action: 'cancel', id: cancel[1] };

  const m = text.match(/^agendar\s+whatsapp(?:\s+sim)?\s*[:\-—]?\s*(.*)$/is);
  if (m) {
    const wantsSim = /\bagendar\s+whatsapp\s+sim\b/i.test(text);
    return { action: 'schedule', rest: m[1], confirmed: wantsSim };
  }

  return null;
}

function newId() {
  const d = new Date();
  const stamp = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `wa_${stamp}_${randomBytes(3).toString('hex')}`;
}

export function loadQueue(file = DEFAULT_QUEUE_FILE) {
  if (!existsSync(file)) return { version: 1, items: [] };
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    return { version: 1, items: Array.isArray(raw.items) ? raw.items : [] };
  } catch {
    return { version: 1, items: [] };
  }
}

export function saveQueue(queue, file = DEFAULT_QUEUE_FILE) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(queue, null, 2), 'utf8');
}

export function loadPending(file = DEFAULT_PENDING_FILE) {
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    if (!raw?.sendAt || !raw?.body) return null;
    if (raw.expiresAt && Date.now() > new Date(raw.expiresAt).getTime()) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export function savePending(pending, file = DEFAULT_PENDING_FILE) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(pending, null, 2), 'utf8');
}

export function clearPending(file = DEFAULT_PENDING_FILE) {
  if (existsSync(file)) writeFileSync(file, '{}', 'utf8');
}

export function formatSp(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

/**
 * @param {string | { body: string, mediaUrl?: string, sendAtIso?: string, contentVariables?: object }} payload
 */
export async function sendTwilioWhatsApp(payload, config = getTwilioConfig({ requireDefaultTo: false })) {
  if (!config.ok) return { ok: false, error: config.error };
  const { accountSid, authToken, from } = config;
  const to =
    (typeof payload === 'object' && payload?.to) ||
    config.toOverride ||
    config.to;
  if (!to) {
    return { ok: false, error: 'Destino WhatsApp (to) em falta.' };
  }

  const rawBody = typeof payload === 'string' ? payload : payload?.body ?? '';
  const sendAtIso = typeof payload === 'object' ? payload.sendAtIso : undefined;
  const mediaUrl =
    (typeof payload === 'object' ? payload.mediaUrl : '') ||
    config.defaultMediaUrl ||
    '';
  const body =
    typeof payload === 'object' && payload.formatted === false
      ? String(rawBody).slice(0, 1600)
      : formatOutboundBody({ text: rawBody, sendAtIso }, config).slice(0, 1600);

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ From: from, To: to });

  if (config.useTemplate && config.contentSid) {
    const vars =
      (typeof payload === 'object' && payload.contentVariables) ||
      buildContentVariables({ text: rawBody, sendAtIso });
    params.set('ContentSid', config.contentSid);
    params.set('ContentVariables', JSON.stringify(vars));
  } else {
    params.set('Body', body);
    if (mediaUrl) params.set('MediaUrl', mediaUrl);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.message || `Twilio HTTP ${res.status}`;
    const hint =
      data.code === 63015 || String(err).includes('63015')
        ? ' Número fora do sandbox Twilio — peça para enviar join ao código do console.'
        : '';
    return {
      ok: false,
      error: err + hint,
      code: data.code,
    };
  }
  return { ok: true, sid: data.sid, status: data.status };
}

export function scheduleMessage(
  { body, sendAt, mediaUrl = '', to = null, contactId = null, contactName = null },
  file = DEFAULT_QUEUE_FILE
) {
  const minAhead = 60 * 1000;
  const maxAhead = 365 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const t = sendAt.getTime();

  if (t < now + minAhead) {
    return { ok: false, error: 'O horário tem de ser pelo menos 1 minuto no futuro.' };
  }
  if (t > now + maxAhead) {
    return { ok: false, error: 'Máximo 365 dias à frente.' };
  }

  const queue = loadQueue(file);
  const item = {
    id: newId(),
    body: String(body).trim(),
    mediaUrl: mediaUrl ? String(mediaUrl).trim() : '',
    sendAt: sendAt.toISOString(),
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    sentAt: null,
    twilioSid: null,
    error: null,
    to: to ? normalizeWhatsApp(to) : null,
    contactId: contactId ? String(contactId).trim() : null,
    contactName: contactName ? String(contactName).trim() : null,
  };
  queue.items.push(item);
  saveQueue(queue, file);
  return { ok: true, item };
}

export function listScheduled(file = DEFAULT_QUEUE_FILE) {
  const queue = loadQueue(file);
  const items = queue.items
    .filter((i) => i.status === 'scheduled')
    .sort((a, b) => a.sendAt.localeCompare(b.sendAt));
  return { ok: true, items };
}

export function cancelScheduled(id, file = DEFAULT_QUEUE_FILE) {
  const queue = loadQueue(file);
  const item = queue.items.find((i) => i.id === id || i.id.startsWith(id));
  if (!item) return { ok: false, error: `Agendamento não encontrado: ${id}` };
  if (item.status !== 'scheduled') {
    return { ok: false, error: `Já não está agendado (estado: ${item.status}).` };
  }
  item.status = 'cancelled';
  item.cancelledAt = new Date().toISOString();
  saveQueue(queue, file);
  return { ok: true, item };
}

export async function dispatchDue({ dryRun = false, file = DEFAULT_QUEUE_FILE } = {}) {
  const cfg = getTwilioConfig({ requireDefaultTo: false });
  if (!cfg.ok && !dryRun) {
    return { ok: false, error: cfg.error, sent: 0, failed: 0 };
  }

  const queue = loadQueue(file);
  const now = Date.now();
  let sent = 0;
  let failed = 0;
  const details = [];

  for (const item of queue.items) {
    if (item.status !== 'scheduled') continue;
    if (new Date(item.sendAt).getTime() > now) continue;

    const dest = item.to || cfg.to;
    if (!dest) {
      item.status = 'failed';
      item.error = 'Destino em falta (to ou TWILIO_WHATSAPP_TO)';
      failed++;
      details.push({ id: item.id, ok: false, error: item.error });
      continue;
    }

    const outbound = {
      body: item.body,
      sendAtIso: item.sendAt,
      mediaUrl: item.mediaUrl || cfg.defaultMediaUrl,
      to: dest,
    };

    if (dryRun) {
      details.push({
        id: item.id,
        dryRun: true,
        to: dest,
        body: formatOutboundBody(outbound, cfg),
        mediaUrl: outbound.mediaUrl || null,
      });
      sent++;
      continue;
    }

    const result = await sendTwilioWhatsApp(outbound, { ...cfg, toOverride: dest });
    if (result.ok) {
      item.status = 'sent';
      item.sentAt = new Date().toISOString();
      item.twilioSid = result.sid;
      sent++;
      details.push({ id: item.id, ok: true, sid: result.sid });
    } else {
      item.status = 'failed';
      item.error = result.error;
      failed++;
      details.push({ id: item.id, ok: false, error: result.error });
    }
  }

  saveQueue(queue, file);
  return { ok: failed === 0, sent, failed, details };
}

/**
 * Handler Jarvis / CLI — interpreta mensagem do utilizador.
 */
export async function handleScheduleCommand(
  message,
  { file = DEFAULT_QUEUE_FILE, pendingFile = DEFAULT_PENDING_FILE } = {}
) {
  const text = String(message).trim();

  if (/^(sim|confirmar|ok)\b/i.test(text) && text.length < 48) {
    const pending = loadPending(pendingFile);
    if (pending) {
      clearPending(pendingFile);
      const sendAt = new Date(pending.sendAt);
      const r = scheduleMessage(
        {
          body: pending.body,
          sendAt,
          mediaUrl: pending.mediaUrl,
          to: pending.to,
          contactId: pending.contactId,
          contactName: pending.contactName,
        },
        file
      );
      if (!r.ok) return { ok: false, reply: r.error };
      return {
        ok: true,
        item: r.item,
        reply: `Agendado (${r.item.id}) para ${formatSp(r.item.sendAt)}.`,
      };
    }
  }

  const parsed = parseUserCommand(message);
  if (!parsed) {
    return { ok: false, error: 'comando_nao_reconhecido' };
  }

  if (parsed.action === 'list') {
    const { items } = listScheduled(file);
    if (!items.length) {
      return { ok: true, reply: 'Nenhum lembrete WhatsApp agendado.' };
    }
    const lines = items.map((i) => {
      const who = i.contactName || i.contactId || (i.to ? 'contacto' : 'eu');
      return `• ${i.id} — ${formatSp(i.sendAt)} — [${who}] ${i.body.slice(0, 60)}`;
    });
    return { ok: true, reply: `Agendados (${items.length}):\n${lines.join('\n')}` };
  }

  if (parsed.action === 'cancel') {
    const r = cancelScheduled(parsed.id, file);
    if (!r.ok) return { ok: false, reply: r.error };
    return {
      ok: true,
      reply: `Cancelado: ${r.item.id} (era para ${formatSp(r.item.sendAt)}).`,
    };
  }

  if (parsed.action === 'schedule') {
    const tw = getTwilioConfig();
    if (!tw.ok) {
      return { ok: false, reply: tw.error };
    }

    const dt = parseDateTimeAndBody(parsed.rest);
    if (dt.error) return { ok: false, reply: dt.error };

    if (!parsed.confirmed) {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      savePending(
        {
          body: dt.body,
          sendAt: dt.sendAt.toISOString(),
          mediaUrl: dt.mediaUrl,
          expiresAt,
          createdAt: new Date().toISOString(),
        },
        pendingFile
      );
      const qh = quietHoursWarningForSendAt(dt.sendAt);
      return {
        ok: true,
        needsApproval: true,
        preview: {
          sendAt: dt.sendAt.toISOString(),
          body: dt.body,
          formatted: formatSp(dt.sendAt.toISOString()),
          quietHours: Boolean(qh),
        },
        reply: [
          `Lembrete WhatsApp para ${formatSp(dt.sendAt.toISOString())}:`,
          `"${dt.body.slice(0, 200)}${dt.body.length > 200 ? '…' : ''}"`,
          dt.mediaUrl ? `Imagem: ${dt.mediaUrl}` : '',
          qh ? `⚠️ ${qh}` : '',
          '',
          'Pré-visualização do texto:',
          formatOutboundBody({
            text: dt.body,
            sendAtIso: dt.sendAt.toISOString(),
          }),
          '',
          'Responde **sim** (válido 30 min) ou: agendar whatsapp sim: …',
          'Imagem no agendamento: acrescenta `| img: https://url` ao fim.',
        ]
          .filter(Boolean)
          .join('\n'),
      };
    }

    const r = scheduleMessage(
      { body: dt.body, sendAt: dt.sendAt, mediaUrl: dt.mediaUrl },
      file
    );
    if (!r.ok) return { ok: false, reply: r.error };
    return {
      ok: true,
      item: r.item,
      reply: `Agendado (${r.item.id}) para ${formatSp(r.item.sendAt)}. Envio automático no WhatsApp.`,
    };
  }

  return { ok: false, error: 'acao_desconhecida' };
}

/**
 * Enviar mensagem para contacto da rubrica (agendar ou confirmar).
 */
export async function handleSendContactCommand(
  message,
  { file = DEFAULT_QUEUE_FILE, pendingFile = DEFAULT_PENDING_FILE } = {}
) {
  const text = String(message).trim();

  if (/^(sim|confirmar|ok)\b/i.test(text) && text.length < 48) {
    const pending = loadPending(pendingFile);
    if (pending?.contactId || pending?.to) {
      clearPending(pendingFile);
      if (pending.sendNow) {
        const tw = getTwilioConfig({ requireDefaultTo: false });
        if (!tw.ok) return { ok: false, reply: tw.error };
        const result = await sendTwilioWhatsApp(
          {
            body: pending.body,
            to: pending.to,
            formatted: false,
          },
          { ...tw, toOverride: pending.to }
        );
        if (!result.ok) return { ok: false, reply: result.error };
        return {
          ok: true,
          reply: `Enviado para ${pending.contactName || pending.contactId} (Twilio ${result.sid}).`,
        };
      }
      const sendAt = new Date(pending.sendAt);
      const r = scheduleMessage(
        {
          body: pending.body,
          sendAt,
          mediaUrl: pending.mediaUrl,
          to: pending.to,
          contactId: pending.contactId,
          contactName: pending.contactName,
        },
        file
      );
      if (!r.ok) return { ok: false, reply: r.error };
      return {
        ok: true,
        item: r.item,
        reply: `Agendado para ${pending.contactName || pending.contactId} (${r.item.id}) em ${formatSp(r.item.sendAt)}.`,
      };
    }
  }

  const parsed = parseSendContactCommand(message);
  if (!parsed) return { ok: false, error: 'comando_nao_reconhecido' };

  const contact = resolveContact(parsed.contactId);
  if (!contact.ok) return { ok: false, reply: contact.error };

  const tw = getTwilioConfig({ requireDefaultTo: false });
  if (!tw.ok) return { ok: false, reply: tw.error };

  let sendAt = null;
  let mediaUrl = '';
  let sendNow = false;

  if (!parsed.timeRest || /^agora$/i.test(parsed.timeRest)) {
    sendNow = true;
    sendAt = new Date(Date.now() + 2 * 60 * 1000);
  } else {
    const dt = parseDateTimeAndBody(parsed.timeRest);
    if (dt.error) return { ok: false, reply: dt.error };
    sendAt = dt.sendAt;
    mediaUrl = dt.mediaUrl || '';
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  savePending(
    {
      body: parsed.body,
      sendAt: sendAt.toISOString(),
      mediaUrl,
      to: contact.phone,
      contactId: contact.id,
      contactName: contact.label,
      sendNow,
      expiresAt,
      createdAt: new Date().toISOString(),
    },
    pendingFile
  );

  const whenLabel = sendNow
    ? 'agora (após confirmar)'
    : formatSp(sendAt.toISOString());
  const qh = quietHoursWarningForSendAt(sendNow ? new Date() : sendAt);

  return {
    ok: true,
    needsApproval: true,
    preview: {
      sendAt: sendAt.toISOString(),
      body: parsed.body,
      formatted: whenLabel,
      contact: contact.label,
      to: contact.phone,
      quietHours: Boolean(qh),
    },
    reply: [
      `WhatsApp para ${contact.label} (${contact.phone}):`,
      `🕐 ${whenLabel}`,
      `"${parsed.body.slice(0, 200)}${parsed.body.length > 200 ? '…' : ''}"`,
      contact.bestTime ? `Janela preferida: ${contact.bestTime}` : '',
      qh ? `⚠️ ${qh}` : '',
      '',
      'Responde **sim** (30 min) para confirmar.',
      'Sandbox: destinatário precisa ter feito join no número Twilio.',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
