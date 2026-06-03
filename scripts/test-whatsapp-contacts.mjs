#!/usr/bin/env node
/**
 * Teste local — contactos + enviar (sem Twilio real).
 * node scripts/test-whatsapp-contacts.mjs
 */
import { addContact, listContacts, removeContact } from './lib/whatsapp-contacts.mjs';
import { handleSendContactCommand } from './lib/scheduled-whatsapp-core.mjs';

const testId = 'teste_cli_' + Date.now().toString(36);

const add = await addContact({
  id: testId,
  phone: '+5511999887766',
  type: 'friend',
  bestTime: '18:00-21:00',
});
console.log('[add]', add.ok ? 'OK' : add.error);

const list = await listContacts();
console.log('[list]', list.items.filter((c) => c.id === testId).length ? 'found' : 'missing');

const send = await handleSendContactCommand(
  `enviar ${testId} "ola FRIDAY teste" amanha 10:00`
);
console.log('[send]', send.ok, 'needsApproval=', send.needsApproval, 'contact=', send.preview?.contact);

await removeContact(testId);
console.log('[cleanup] removed', testId);
