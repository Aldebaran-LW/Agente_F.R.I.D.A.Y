# Telegram na EC2 — corrigir idioma e comportamento

O bot **@LW_Acessor_bot** corre no **OpenClaw da EC2**, não na Vercel nem no HF.

## Por que está em inglês?

| Modo | O que acontece |
|------|----------------|
| **LLM directo** (default OpenClaw) | Modelo responde em **inglês** — mensagens tipo "access not configured" também vêm do OpenClaw |
| **Jarvis via gateway** | Respostas em **português** (`gateway/lib/jarvis-reply.mjs`, `telegram-format.mjs`) |

Objectivo: SOUL em PT + skill **`openclaw-jarvis`** para comandos operacionais.

---

## Passo 1 — Testar o gateway (no PC)

Confirma que o Jarvis em português funciona **antes** do Telegram:

```powershell
cd "H:\Meu Drive\Projetos\OpenClaw\scripts"
node jarvis-ask.mjs --telegram "resumo portfolio"
node jarvis-ask.mjs --telegram "ajuda"
```

Deves ver `telegram_html` em português na JSON.

---

## Passo 2 — EC2: sync completo (recomendado)

**Do PC (PowerShell):**

```powershell
cd "H:\Meu Drive\Projetos\OpenClaw"
.\scripts\ec2-sync-from-pc.ps1
```

**Ou na EC2 (SSH):**

```bash
cd /opt/openclaw
git pull origin main
sudo bash scripts/ec2-sync-now.sh
```

O script faz: `git pull`, SOUL Jarvis PT, `ec2-fix-telegram-models`, heartbeat/Heimdall, teste ao gateway Vercel (`routes_version: 3`).

Guia: `docs/EC2-SYNC-NOW.md`

---

## Passo 3 — Modelo Ollama (sem OpenRouter)

Stack actual: **Ollama local** na EC2 — sem quota externa.

```bash
cd /opt/openclaw
git pull
sudo bash scripts/ec2-fix-telegram-models.sh
```

Garantir no `.env` da EC2:

```env
OPENCLAW_GATEWAY_BASE_URL=https://openclaw.lwdigitalforge.com
OPENCLAW_AUTOMATION_TOKEN=...
# OPENROUTER_API_KEY=   # removido — nao usar
```

---

## Passo 4 — Pairing (se ainda pedir código)

No Telegram: manda `oi` → copia o código → na EC2 **logo a seguir**:

```bash
sudo openclaw pairing approve telegram CODIGO_AQUI
sudo openclaw pairing list --channel telegram
```

---

## Passo 5 — BotFather (comandos PT)

No [@BotFather](https://t.me/BotFather):

```
/setcommands
```

```
start - Menu Jarvis (ajuda)
status - Status Macofel
github - Repos Aldebaran-LW
sites - Sites no ar
resumo - Resumo portfolio
```

---

## O que enviar no Telegram (exemplos)

```
resumo portfolio
status macofel
repos github
sites no ar
ajuda
```

Evita perguntas abertas tipo "what can you do" — preferir comandos acima.

---

## Logs se não responder

```bash
sudo journalctl -u openclaw-gateway -f
```

Erros comuns:

| Sintoma | Causa | Fix |
|---------|--------|-----|
| Rate limit / all models failed | OpenRouter quota esgotada | `sudo bash scripts/ec2-fix-telegram-models.sh` (Ollama only) |
| Auto-compaction error | Sessão longa | `/new` + `reserveTokensFloor: 20000` (script acima) |
| Inglês genérico | Falta SOUL.md | `ec2-apply-agent-config.sh` |
| Silêncio | Pairing não aprovado | `openclaw pairing approve telegram CODIGO` |

Script de correção rápida na EC2:

```bash
cd /opt/openclaw && git pull
sudo bash scripts/ec2-fix-telegram-models.sh
```

Depois no Telegram: **`/new`** → **`ajuda`**

---

## Jarvis integrado no OpenClaw (recomendado)

Um so bot. O agente corre o hook antes do LLM:

```bash
node scripts/openclaw-jarvis-hook.mjs "ajuda"
```

Documentacao: `docs/OPENCLAW-JARVIS-INTEGRACAO.md`

Apos redeploy Vercel: `ajuda` no Telegram deve mostrar botoes (reply_markup).

**Nao** activar `openclaw-telegram-jarvis-bridge --poll` no mesmo token.

## Fase seguinte

1. Supabase para aprovações — `docs/SUPABASE-CENTRAL.md`
2. Integrar bridge **dentro** do OpenClaw (um só `getUpdates`)

Ver: `docs/TELEGRAM-UX.md` · `docs/TELEGRAM-WHATSAPP-FLOW.md`
