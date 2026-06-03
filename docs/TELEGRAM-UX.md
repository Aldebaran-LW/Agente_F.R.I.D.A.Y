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

## Conflito OpenClaw vs Jarvis (slash)

O OpenClaw na EC2 regista **comandos nativos** (`/status`, `/model`, `/compact`, …). Esses são tratados **pelo daemon** antes do hook Jarvis.

| O que vês | O que aconteceu |
|-----------|-----------------|
| `/status` → versão OpenClaw, HF, Groq | Comando **nativo** OpenClaw (não é Macofel) |
| `/quotas`, `/office`, `Ajuda` → *Something went wrong* | Slash desconhecido ou hook **desactualizado** na EC2 |
| `status macofel`, `ajuda`, `rimuru status` | Hook → gateway Vercel ✅ (se EC2 com `git pull`) |

**Regra prática:** operação = **texto** (`status macofel`, `ajuda`) ou **`/jarvis …`** (`/jarvis quotas`).

Depois de `git pull` na EC2, testa: `node scripts/openclaw-jarvis-hook.mjs "/quotas"` → deve sair `handled: true`.

## Comandos sugeridos no BotFather

| Comando | Ação |
|---------|------|
| `/start` | Menu de ajuda (chamar Jarvis com `ajuda`) |
| `/status` | ⚠️ **Conflito:** OpenClaw nativo mostra versão/modelos. Para **Macofel** use `status macofel` ou `/jarvis status macofel` |
| `/quotas` | ⚠️ Só funciona se o **hook EC2** estiver actualizado. Alternativa: `rimuru status` ou `/jarvis quotas` |
| `/office` | ⚠️ Idem. Alternativa: `situação dos agentes` ou `/jarvis office` |
| `/github` | `repos github` |
| `/sites` | `sites no ar` |
| `/resumo` | `resumo portfolio` |
| `/lembrete` | Menu WhatsApp (botão 📱) |
| `pesquisa mercado` | Yato (inovação HF) |
| `tokens openrouter` / `/quotas` | Rimuru (consumo APIs) |
| `previsão de vendas` | Workflow Yato → Gideon (HF) |
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
