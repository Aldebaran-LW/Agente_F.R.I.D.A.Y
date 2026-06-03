/**
 * Preferências do utilizador (JSON local / Hub futuro).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_ROOT = join(__dirname, '..', '..');

const DEFAULTS = {
  version: 1,
  timezone: 'America/Sao_Paulo',
  quietHours: { start: '22:00', end: '09:00' },
  preferredTone: 'informal',
  autoApproveCategories: [],
  outcomes: [],
};

export function preferencesDataRoot() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return '/tmp/openclaw';
  }
  return join(WORKSPACE_ROOT, 'data');
}

export function preferencesFile() {
  return join(preferencesDataRoot(), 'user-preferences.json');
}

export function loadPreferences(file = preferencesFile()) {
  if (!existsSync(file)) {
    return { ...DEFAULTS, outcomes: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    return {
      ...DEFAULTS,
      ...raw,
      quietHours: { ...DEFAULTS.quietHours, ...(raw.quietHours || {}) },
      autoApproveCategories: Array.isArray(raw.autoApproveCategories)
        ? raw.autoApproveCategories
        : [],
      outcomes: Array.isArray(raw.outcomes) ? raw.outcomes : [],
    };
  } catch {
    return { ...DEFAULTS, outcomes: [] };
  }
}

export function savePreferences(doc, file = preferencesFile()) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
}

export function getPreference(key, file = preferencesFile()) {
  const doc = loadPreferences(file);
  if (key === 'quietHours') return doc.quietHours;
  if (key === 'timezone') return doc.timezone;
  if (key === 'preferredTone') return doc.preferredTone;
  if (key === 'autoApproveCategories') return doc.autoApproveCategories;
  return doc[key];
}

export function setPreference(key, value, file = preferencesFile()) {
  const doc = loadPreferences(file);
  if (key === 'quietHours') {
    const m = String(value).match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) return { ok: false, error: 'Formato: HH:MM-HH:MM (ex. 22:00-09:00)' };
    doc.quietHours = { start: m[1], end: m[2] };
  } else if (key === 'timezone') {
    doc.timezone = String(value).trim();
  } else if (key === 'preferredTone') {
    doc.preferredTone = String(value).trim();
  } else if (key === 'autoApproveCategories') {
    doc.autoApproveCategories = String(value)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    doc[key] = value;
  }
  savePreferences(doc, file);
  return { ok: true, value: getPreference(key, file) };
}

export function recordOutcome(type, outcome, meta = {}, file = preferencesFile()) {
  const doc = loadPreferences(file);
  doc.outcomes.push({
    type: String(type),
    outcome: String(outcome),
    meta,
    at: new Date().toISOString(),
  });
  if (doc.outcomes.length > 200) {
    doc.outcomes = doc.outcomes.slice(-200);
  }
  savePreferences(doc, file);
  return { ok: true };
}

/** Parse HH:MM para minutos desde meia-noite. */
function parseHm(hm) {
  const m = String(hm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Quiet hours overnight: ex. 22:00–09:00 = quiet se >= 22 ou < 09.
 */
export function isInQuietHours(at = new Date(), prefs = loadPreferences()) {
  const tz = prefs.timezone || 'America/Sao_Paulo';
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  const start = parseHm(prefs.quietHours?.start);
  const end = parseHm(prefs.quietHours?.end);
  if (start == null || end == null) return { inQuiet: false };

  if (start < end) {
    return {
      inQuiet: mins >= start && mins < end,
      range: `${prefs.quietHours.start}-${prefs.quietHours.end}`,
      timezone: tz,
    };
  }
  return {
    inQuiet: mins >= start || mins < end,
    range: `${prefs.quietHours.start}-${prefs.quietHours.end}`,
    timezone: tz,
  };
}

export function quietHoursWarningForSendAt(sendAt, prefs = loadPreferences()) {
  const check = isInQuietHours(sendAt, prefs);
  if (!check.inQuiet) return null;
  return `Horário ${formatSpLocal(sendAt, prefs.timezone)} está em quiet hours (${check.range}, ${check.timezone}). Responde **sim** para confirmar mesmo assim.`;
}

function formatSpLocal(date, tz) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function parsePreferenceCommand(message = '') {
  const text = String(message).trim();
  if (/^preferencia\s+listar$/i.test(text) || /^\/preferencia$/i.test(text)) {
    return { action: 'list' };
  }
  const set = text.match(/^preferencia\s+set\s+(\w+)\s+(.+)$/i);
  if (set) return { action: 'set', key: set[1], value: set[2].trim() };
  return null;
}

export async function handlePreferenceCommand(message, file = preferencesFile()) {
  const parsed = parsePreferenceCommand(message);
  if (!parsed) return { ok: false, error: 'comando_nao_reconhecido' };

  if (parsed.action === 'list') {
    const doc = loadPreferences(file);
    return {
      ok: true,
      reply: [
        'Preferências:',
        `• timezone: ${doc.timezone}`,
        `• quietHours: ${doc.quietHours.start}-${doc.quietHours.end}`,
        `• preferredTone: ${doc.preferredTone}`,
        `• autoApproveCategories: ${doc.autoApproveCategories.length ? doc.autoApproveCategories.join(', ') : '(vazio — tudo supervisionado)'}`,
        `• outcomes registados: ${doc.outcomes.length}`,
      ].join('\n'),
    };
  }

  if (parsed.action === 'set') {
    const r = setPreference(parsed.key, parsed.value, file);
    if (!r.ok) return { ok: false, reply: r.error };
    return { ok: true, reply: `OK: ${parsed.key} = ${JSON.stringify(r.value)}` };
  }

  return { ok: false, error: 'acao_desconhecida' };
}
