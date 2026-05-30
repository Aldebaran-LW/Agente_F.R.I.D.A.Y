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

## Passo 2 — EC2: SOUL em português

SSH na EC2:

```bash
cd /opt/openclaw   # ou ~/Agente_OpenClaw
git pull

# Copiar regras Jarvis PT (ou usar ec2-apply-agent-config.sh — copia SOUL automaticamente)
sudo cp agents/_shared/SOUL-TELEGRAM-JARVIS.md /root/.openclaw/workspace/SOUL.md
# Se o daemon corre como outro user, ajusta o path ~/.openclaw/workspace/

sudo systemctl restart openclaw-gateway
```

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

## Fase seguinte (elegante)

Quando estiver estável:

1. Bridge Telegram → sempre `POST /jarvis` + `telegram_html` (custom hook EC2)
2. Supabase para aprovações — `docs/SUPABASE-CENTRAL.md`

Ver também: `docs/TELEGRAM-UX.md` · `agents/orchestrator/AGENTS.md`
