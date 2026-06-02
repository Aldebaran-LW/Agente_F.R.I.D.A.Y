# OpenClaw + Jarvis (um bot, bridge automático)

## Ideia

```text
Telegram (@teu_bot)
       │
       ▼
  OpenClaw (EC2)  ─── único getUpdates
       │
       ├─ Mensagem operacional? ──► openclaw-jarvis-hook.mjs ──► POST /jarvis (Vercel)
       │                                      │
       │                                      └─► HTML + botões + WhatsApp agendado
       │
       └─ Conversa livre? ──► LLM (HF/Groq/…) como hoje
```

**Não precisas** do serviço `openclaw-telegram-jarvis-bridge --poll` no mesmo bot. Isso era plano B (dois ouvintes). O modelo certo é este.

## Como o OpenClaw chama o Jarvis

| Gatilho | Exemplo |
|---------|---------|
| **Automático** | `status macofel`, `repos github`, `agendar whatsapp: …` |
| **Comando** | `/jarvis repos github` |
| **Slash BotFather** | `/status` → vira `status macofel` |
| **Botão** | `callback_data` `j:m:wa` → hook `--callback=…` |
| **Confirmação** | `sim` com lembrete WhatsApp pendente |

Script: `scripts/openclaw-jarvis-hook.mjs`  
Lógica “é operacional?”: `scripts/lib/jarvis-route.mjs` (mesmas regras do `jarvis-router` na Vercel).

## O que configurar na EC2

1. `.env` com `OPENCLAW_GATEWAY_BASE_URL`, `OPENCLAW_AUTOMATION_TOKEN`, Telegram, Twilio.
2. SOUL: `agents/_shared/SOUL-TELEGRAM-JARVIS.md` (já manda usar skill `openclaw-jarvis`).
3. Orchestrator skills: `politica-seguranca`, `openclaw-jarvis` (`ec2-tiered-llm-patch.mjs`).
4. `tools.profile`: **messaging** (para enviar HTML + botões).
5. **Redeploy Vercel** com `reply_markup` no `/jarvis`.

Teste na EC2:

```bash
node scripts/openclaw-jarvis-hook.mjs "ajuda"
node scripts/openclaw-jarvis-hook.mjs "explica relatividade quântica"   # exit 2 → LLM
node scripts/openclaw-jarvis-hook.mjs "/jarvis status macofel"
```

## BotFather (opcional)

```
jarvis - Forçar gateway (ex: /jarvis ajuda)
lembrete - Atalho WhatsApp
```

Comandos `/status`, `/github`, etc. já mapeados no hook.

## Fluxo WhatsApp

1. Telegram: botão **📱 WhatsApp** → **☀️ Amanhã 9h** → **✅ Confirmar**
2. Hook → `/jarvis` → fila `data/scheduled-whatsapp.json`
3. `heartbeat.py` → Twilio → WhatsApp + imagem FRIDAY

## Quando ainda usar bridge --poll?

Só se **não** conseguires que o OpenClaw execute o hook (bug ou modelo ignora a skill). Aí:

- ou corriges SOUL/skill,
- ou segundo bot só Jarvis,
- **nunca** dois polls no mesmo token.

## Ficheiros

| Ficheiro | Papel |
|----------|--------|
| `scripts/openclaw-jarvis-hook.mjs` | Porta de entrada EC2 |
| `scripts/lib/jarvis-route.mjs` | Auto vs LLM |
| `scripts/lib/telegram-jarvis-client.mjs` | HTTP Jarvis + Telegram API |
| `skills/openclaw-jarvis/SKILL.md` | Instruções do agente |
| `gateway/api/jarvis.mjs` | Cérebro na Vercel |
