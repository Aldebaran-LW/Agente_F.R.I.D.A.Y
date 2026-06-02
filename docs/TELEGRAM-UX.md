# Telegram — interação elegante (Jarvis)

Telegram corre na **AWS EC2** (OpenClaw). O gateway Vercel devolve texto pronto para enviar.

**Corrigir bot em inglês / comportamento:** [TELEGRAM-EC2-AGORA.md](./TELEGRAM-EC2-AGORA.md) · SOUL: `agents/_shared/SOUL-TELEGRAM-JARVIS.md`

## Formato das mensagens

O `POST /jarvis` inclui:

```json
{
  "reply": "texto simples (fallback)",
  "telegram": {
    "text": "igual ao reply",
    "telegram_html": "<b>Macofel</b> …",
    "parse_mode": "HTML",
    "reply_markup": {
      "inline_keyboard": [[{ "text": "📱 WhatsApp", "callback_data": "j:m:wa" }]]
    }
  }
}
```

Na EC2, ao responder ao utilizador:

```javascript
// Preferir HTML formatado + botões quando existirem
await sendMessage(chatId, body.telegram.telegram_html, {
  parse_mode: 'HTML',
  reply_markup: body.telegram.reply_markup,
});
```

**Callbacks:** ver `docs/TELEGRAM-WHATSAPP-FLOW.md` e `scripts/lib/telegram-callback-bridge.mjs`.

Se `telegram_html` falhar (caracteres inválidos), usar `reply` em texto simples.

## Tom (Jarvis)

- Português (PT), **curto**, profissional, sem secrets.
- Títulos em **negrito**, números e comandos em `monospace`.
- Emojis só como ícones de estado (✅ ❌ ⚠️ 📋) — não encher a mensagem.
- Aprovações: bloco claro com **sim** / **confirmar** / **ok**.

## Comandos sugeridos no BotFather

| Comando | Ação |
|---------|------|
| `/start` | Menu de ajuda (chamar Jarvis com `ajuda`) |
| `/status` | `status macofel` |
| `/github` | `repos github` |
| `/sites` | `sites no ar` |
| `/resumo` | `resumo portfolio` |
| `/lembrete` | Menu WhatsApp (botão 📱) |
| `pesquisa mercado` | Yato (inovação HF) |
| `tokens openrouter` | Rimuru (consumo APIs) |
| `auditoria seguranca` | Veldora |
| `menu` / `ajuda` | Lista de todos os cérebros |

## Sessões (evitar contexto poluído)

- **Nova conversa** por tipo de tarefa (Macofel vs deploy vs conversa livre).
- Depois de `sync imagens` + aprovação, **fechar** o assunto com uma linha de confirmação.
- Conversas longas: `/compact` no OpenClaw antes de pedir análise complexa.

## Base de dados

Estado de aprovações e sessões → **Supabase central** (futuro). Ver [SUPABASE-CENTRAL.md](./SUPABASE-CENTRAL.md).

Até lá: o EC2 pode guardar `traceId` + pedido pendente em ficheiro local ou pedir `approved: true` no body ao reenviar `sim`.

## Teste sem Telegram

```powershell
cd scripts
node jarvis-ask.mjs "resumo portfolio"
# Ver campo telegram.telegram_html na JSON
```
