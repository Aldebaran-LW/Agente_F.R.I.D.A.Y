import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDateTimeAndBody,
  parseUserCommand,
  normalizeWhatsApp,
  parseMessageExtras,
  formatOutboundBody,
} from './scheduled-whatsapp-core.mjs';

describe('parseUserCommand', () => {
  it('detecta agendar', () => {
    const p = parseUserCommand('agendar whatsapp: 10/06/2026 9:00 — teste');
    assert.equal(p?.action, 'schedule');
  });

  it('detecta lista', () => {
    const p = parseUserCommand('lista agendamentos whatsapp');
    assert.equal(p?.action, 'list');
  });
});

describe('parseDateTimeAndBody', () => {
  it('parse DD/MM/AAAA HH:MM', () => {
    const r = parseDateTimeAndBody('10/06/2026 14:30 — Reunião');
    assert.ok(r.sendAt);
    assert.equal(r.body, 'Reunião');
  });
});

describe('normalizeWhatsApp', () => {
  it('adiciona prefixo', () => {
    assert.equal(normalizeWhatsApp('5511999999999'), 'whatsapp:+5511999999999');
  });
});

describe('parseMessageExtras', () => {
  it('extrai img URL', () => {
    const r = parseMessageExtras('Reunião | img: https://cdn.example.com/a.png');
    assert.equal(r.body, 'Reunião');
    assert.equal(r.mediaUrl, 'https://cdn.example.com/a.png');
  });
});

describe('formatOutboundBody', () => {
  it('estilo card', () => {
    const text = formatOutboundBody(
      { text: 'Teste', sendAtIso: '2026-06-01T12:00:00.000Z' },
      {
        ok: true,
        bodyStyle: 'card',
        brand: 'FRIDAY',
        footer: 'OpenClaw',
      }
    );
    assert.match(text, /FRIDAY · Lembrete/);
    assert.match(text, /Teste/);
  });
});
