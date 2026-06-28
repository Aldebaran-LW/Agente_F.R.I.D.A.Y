# scheduled-whatsapp

Lembretes **WhatsApp** para o Lucas (Twilio), agendados por data/hora.

## Variáveis (.env na raiz)

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM` — ex. `whatsapp:+14155238886`
- `TWILIO_WHATSAPP_TO` — teu número verificado
- `TWILIO_WHATSAPP_BODY_STYLE` — `card` (default) ou `plain`
- `TWILIO_WHATSAPP_BRAND` — ex. `FRIDAY`
- `TWILIO_WHATSAPP_FOOTER` — rodapé opcional
- `TWILIO_WHATSAPP_DEFAULT_MEDIA_URL` — imagem em todos os lembretes (https público)
- `TWILIO_WHATSAPP_USE_TEMPLATE` — `0` sandbox / `1` + `TWILIO_WHATSAPP_CONTENT_SID` (HX…)

## Telegram (via Jarvis)

| Comando | Exemplo |
|---------|---------|
| Agendar | `agendar whatsapp: 05/06/2026 14:30 — Revisar catálogo` |
| Com imagem | `… — Reunião \| img: https://cdn…/logo.png` |
| Confirmar | `sim` ou `agendar whatsapp sim: amanhã 9:00 — Bom dia` |
| Listar | `lista agendamentos whatsapp` |
| Cancelar | `cancelar whatsapp wa_20260601_abc` |

## Dispatcher

```bash
node scripts/scheduled-whatsapp-dispatch.mjs
```

O `scripts/heartbeat.py` chama isto em cada execução (se `SCHEDULED_WHATSAPP_ENABLED=1`).

## Política

- Só envia para `TWILIO_WHATSAPP_TO` (não terceiros).
- Primeiro pedido pede confirmação (`sim`).
