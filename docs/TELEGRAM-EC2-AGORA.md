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

## Passo 3 — Modelo e sync agentes

Evitar Gemini em quota (429); preferir OpenRouter free:

```bash
set -a; source /opt/openclaw/.env; set +a

# Sync modelos dos agents/*/config.yaml
node scripts/sync-agent-config-to-openclaw.mjs --emit-sh | sudo bash

# Ou manualmente orquestrador:
sudo openclaw config set agents.list.orchestrator.model.primary "openrouter/nvidia/nemotron-3-super-120b-a12b:free"
sudo openclaw config set agents.list.orchestrator.model.fallbacks '["openrouter/google/gemini-2.0-flash","ollama/llama3.2:1b"]'

sudo systemctl restart openclaw-gateway
```

Garantir no `.env` da EC2:

```env
OPENCLAW_GATEWAY_BASE_URL=https://openclaw.lwdigitalforge.com
OPENCLAW_AUTOMATION_TOKEN=...
OPENROUTER_API_KEY=...
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

| Sintoma | Causa |
|---------|--------|
| Inglês genérico | Falta SOUL.md ou LLM sem instrução PT |
| Silêncio | Gemini 429 / sem OpenRouter |
| "access not configured" | Pairing não aprovado |
| Números errados | Não usou gateway — pedir `status macofel` |

---

## Fase seguinte (elegante)

Quando estiver estável:

1. Bridge Telegram → sempre `POST /jarvis` + `telegram_html` (custom hook EC2)
2. Supabase para aprovações — `docs/SUPABASE-CENTRAL.md`

Ver também: `docs/TELEGRAM-UX.md` · `agents/orchestrator/AGENTS.md`
