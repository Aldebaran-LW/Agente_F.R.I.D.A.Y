/**
 * Rubrica de contactos WhatsApp (Twilio sandbox / produção).
 * Persistência: data/whatsapp-contacts.json (ou /tmp/openclaw na Vercel).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeWhatsApp } from './scheduled-whatsapp-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_ROOT = join(__dirname, '..', '..');

export function contactsDataRoot() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return '/tmp/openclaw';
  }
  return join(WORKSPACE_ROOT, 'data');
}

export function contactsFile() {
  return join(contactsDataRoot(), 'whatsapp-contacts.json');
}

export function loadContacts(file = contactsFile()) {
  if (!existsSync(file)) {
    return { version: 1, contacts: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    return {
      version: 1,
      contacts: raw.contacts && typeof raw.contacts === 'object' ? raw.contacts : {},
    };
  } catch {
    return { version: 1, contacts: {} };
  }
}

export function saveContacts(doc, file = contactsFile()) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
}

function normalizeContactId(id) {
  return String(id || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function resolveContact(nameOrId, file = contactsFile()) {
  const key = normalizeContactId(nameOrId);
  const { contacts } = loadContacts(file);
  const entry = contacts[key];
  if (!entry?.phone) {
    return { ok: false, error: `Contato "${nameOrId}" não encontrado. Use: contato adicionar ${nameOrId} +55... amigo` };
  }
  const phone = normalizeWhatsApp(entry.phone);
  if (!phone) {
    return { ok: false, error: `Telefone inválido para "${nameOrId}".` };
  }
  return {
    ok: true,
    id: key,
    phone,
    type: entry.type || 'contact',
    bestTime: entry.bestTime || null,
    label: entry.label || key,
  };
}

export function addContact({ id, phone, type = 'contact', bestTime = null, label = null }, file = contactsFile()) {
  const key = normalizeContactId(id);
  if (!key) return { ok: false, error: 'ID do contato inválido.' };
  const normalized = normalizeWhatsApp(phone);
  if (!normalized) return { ok: false, error: 'Telefone inválido (use +55...).' };

  const doc = loadContacts(file);
  doc.contacts[key] = {
    phone: normalized.replace(/^whatsapp:/, '+'),
    type: String(type).trim() || 'contact',
    bestTime: bestTime ? String(bestTime).trim() : null,
    label: label ? String(label).trim() : key,
    updatedAt: new Date().toISOString(),
  };
  saveContacts(doc, file);
  return { ok: true, contact: { id: key, ...doc.contacts[key] } };
}

export function removeContact(nameOrId, file = contactsFile()) {
  const key = normalizeContactId(nameOrId);
  const doc = loadContacts(file);
  if (!doc.contacts[key]) {
    return { ok: false, error: `Contato "${nameOrId}" não encontrado.` };
  }
  delete doc.contacts[key];
  saveContacts(doc, file);
  return { ok: true, id: key };
}

export function listContacts(file = contactsFile()) {
  const doc = loadContacts(file);
  const items = Object.entries(doc.contacts).map(([id, c]) => ({
    id,
    phone: c.phone,
    type: c.type,
    bestTime: c.bestTime,
    label: c.label || id,
  }));
  return { ok: true, items };
}

export function parseContactCommand(message = '') {
  const text = String(message).trim();

  let m = text.match(/^contato\s+adicionar\s+(\S+)\s+(\+?[\d\s-]{10,})\s+(\S+)(?:\s+(.+))?$/i);
  if (m) {
    return {
      action: 'add',
      id: m[1],
      phone: m[2].replace(/\s/g, ''),
      type: m[3],
      bestTime: m[4]?.trim() || null,
    };
  }

  if (/^contato\s+listar$/i.test(text) || /^lista\s+contactos?$/i.test(text)) {
    return { action: 'list' };
  }

  m = text.match(/^contato\s+remover\s+(\S+)$/i);
  if (m) return { action: 'remove', id: m[1] };

  return null;
}

export function parseSendContactCommand(message = '') {
  const text = String(message).trim();
  const m = text.match(
    /^(?:\/enviar|enviar)(?:\s+para)?\s+(\w+)\s+"([^"]+)"(?:\s+(.+))?$/is
  );
  if (!m) return null;
  return {
    contactId: m[1],
    body: m[2].trim(),
    timeRest: m[3]?.trim() || '',
  };
}

export async function handleContactCommand(message, file = contactsFile()) {
  const parsed = parseContactCommand(message);
  if (!parsed) return { ok: false, error: 'comando_nao_reconhecido' };

  if (parsed.action === 'list') {
    const { items } = listContacts(file);
    if (!items.length) {
      return { ok: true, reply: 'Nenhum contacto guardado. Ex.: contato adicionar joao +5511999999999 amigo' };
    }
    const lines = items.map(
      (c) => `• ${c.id} (${c.type}) — ${c.phone}${c.bestTime ? ` · ${c.bestTime}` : ''}`
    );
    return { ok: true, reply: `Contactos (${items.length}):\n${lines.join('\n')}` };
  }

  if (parsed.action === 'remove') {
    const r = removeContact(parsed.id, file);
    if (!r.ok) return { ok: false, reply: r.error };
    return { ok: true, reply: `Contacto removido: ${r.id}` };
  }

  if (parsed.action === 'add') {
    const r = addContact(
      {
        id: parsed.id,
        phone: parsed.phone,
        type: parsed.type,
        bestTime: parsed.bestTime,
      },
      file
    );
    if (!r.ok) return { ok: false, reply: r.error };
    const hint =
      process.env.WHATSAPP_MODE === 'sandbox' || !process.env.WHATSAPP_MODE
        ? '\nSandbox: o número deve enviar join ao +14155238886 antes de receber mensagens.'
        : '';
    return {
      ok: true,
      reply: `Contacto ${r.contact.id} guardado (${r.contact.phone}, ${r.contact.type}).${hint}`,
    };
  }

  return { ok: false, error: 'acao_desconhecida' };
}
