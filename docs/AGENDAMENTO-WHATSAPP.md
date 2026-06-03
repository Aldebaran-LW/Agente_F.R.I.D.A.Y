# Lembretes WhatsApp (FRIDAY / Jarvis)

Agenda mensagens para o teu número via **Twilio WhatsApp**.

## Configuração

No `.env` na raiz do OpenClaw:

```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO=whatsapp:+5511999999999
SCHEDULED_WHATSAPP_ENABLED=1

# Corpo da mensagem
TWILIO_WHATSAPP_BODY_STYLE=card
TWILIO_WHATSAPP_BRAND=FRIDAY
TWILIO_WHATSAPP_FOOTER=OpenClaw · Aldebaran-LW

# Imagem (opcional) — URL https pública
# TWILIO_WHATSAPP_DEFAULT_MEDIA_URL=https://exemplo.com/friday-logo.png

# Template HX (produção); no sandbox use 0
TWILIO_WHATSAPP_USE_TEMPLATE=0
# TWILIO_WHATSAPP_CONTENT_SID=HX...
```

## Corpo da mensagem (`card`)

Exemplo enviado no WhatsApp:

```text
FRIDAY · Lembrete
----------------
01/06/2026, 14:30

Revisar catálogo Macofel

— OpenClaw · Aldebaran-LW
```

`TWILIO_WHATSAPP_BODY_STYLE=plain` → uma linha: `FRIDAY: texto (data)`.

## Imagem

1. **Todos os lembretes:** `TWILIO_WHATSAPP_DEFAULT_MEDIA_URL` no `.env` (logo/banner em CDN ou GitHub raw).
2. **Só num agendamento:** no Telegram, no fim do texto:  
   `agendar whatsapp: 05/06/2026 9:00 — Reunião | img: https://url-da-imagem.png`

A URL tem de ser **https** e acessível publicamente (Twilio faz download ao enviar).

Sandbox: associa o teu número no [console Twilio](https://console.twilio.com) → Messaging → Try WhatsApp.

## Telegram

1. `agendar whatsapp: 05/06/2026 14:30 — Revisar catálogo`
2. Jarvis mostra pré-visualização → respondes `sim`
3. No horário, o **heartbeat** (ou cron) envia pelo WhatsApp

Atalho: `agendar whatsapp sim: amanhã 9:00 — Bom dia`

Outros:

- `lista agendamentos whatsapp`
- `cancelar whatsapp wa_20260601_abc123`

## Contactos (mensagem para terceiros)

Rubrica: `data/whatsapp-contacts.json`

1. `contato adicionar joao +5511999999999 amigo` (opcional: janela `18:00-21:00`)
2. `contato listar`
3. `enviar joao "sua mensagem aqui" amanhã 19:00` → pré-visualização → `sim`
4. No horário, o **heartbeat** envia para o número do contacto (`to` no item da fila)

Sem `to` no job, usa `TWILIO_WHATSAPP_TO` (lembrete só para ti — comportamento anterior).

**Sandbox Twilio:** cada destinatário precisa enviar `join <código>` ao +14155238886 antes de receber.

Ficheiro extra: `scripts/lib/whatsapp-contacts.mjs` · skills `whatsapp-contacts`, `whatsapp-send-contact`

## Preferências (quiet hours)

Ficheiro: `data/user-preferences.json`

- `preferencia listar`
- `preferencia set quietHours 22:00-09:00`
- `preferencia set timezone America/Sao_Paulo`
- `preferencia set preferredTone informal`

Ao agendar/enviar, se o horário cair em quiet hours, o Jarvis avisa; **`sim`** confirma mesmo assim.

## Dispatcher manual

```powershell
node scripts/scheduled-whatsapp-dispatch.mjs
node scripts/scheduled-whatsapp-dispatch.mjs --dry-run
```

O `scripts/heartbeat.py` chama o dispatcher em cada execução (recomendado: cron a cada 1–5 min na VPS ou PC ligado).

## Ficheiros

| Ficheiro | Conteúdo |
|----------|----------|
| `data/scheduled-whatsapp.json` | Fila de lembretes |
| `data/scheduled-whatsapp-pending.json` | Confirmação pendente (30 min) |
