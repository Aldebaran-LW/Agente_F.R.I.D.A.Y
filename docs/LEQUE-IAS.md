# Leque de IAs — tokens gratuitos por assunto

Estratégia: **maximizar cotas free** repartindo provedores e modelos por cérebro, com **uma voz Jarvis** (PT-BR, política única).

Relacionado: [DEEPSEEK-API.md](./DEEPSEEK-API.md) · [OPENROUTER-MODELOS-FREE.md](./OPENROUTER-MODELOS-FREE.md) · [MAPAS-RESIDENCIAS.md](./MAPAS-RESIDENCIAS.md) · [ARQUITETURA-INOVACAO.md](./ARQUITETURA-INOVACAO.md)

---

## Princípios

| Regra | Detalhe |
|-------|---------|
| **Scripts primeiro** | Status Macofel, GitHub, deploy → gateway Vercel / cron — **zero LLM** |
| **Ollama na EC2** | Telegram e agentes locais → `ollama/smollm2:360m` (sem quota externa) |
| **Infron** | Fallback EC2 (`INFRON_API_KEY`) após HF Router |
| **Groq** | Fallback final EC2 (`GROQ_API_KEY`) — ver [GROQ-API.md](./GROQ-API.md) |
| **Kilo Gateway** | HF `friday-prod` — agente **Hefestos** (`kilo-auto/free`) |
| **API directa opcional** | DeepSeek → `DEEPSEEK_API_KEY` (402 se sem saldo) |
| **HF Inference Router** | `HF_TOKEN` + providers HF → fallback complexo Telegram |
| **Mesma linha de raciocínio** | `agents/_shared/VOZ-JARVIS.md` + `POLITICA-SEGURANCA.md` em todos |
| **HF = laboratório** | Sophia/Rebeca/Senku/Hefestos no Space; copiar padrões úteis para EC2/scripts |

---

## Camadas (ordem de custo)

```
1. scripts + POST /jarvis     → 0 tokens
2. Ollama (EC2)               → smollm2:360m (Telegram)
3. APIs directas (opcional)   → DEEPSEEK_API_KEY; HF Router se DeepSeek falhar
4. HF Spaces (inovação)       → HF_TOKEN + stub/scripts
5. Pago                       → só pedido explícito do Lucas
```

---

## Mapa cérebro → provedor → modelo

Definição em `agents/<id>/config.yaml`. Aplicar na EC2: `scripts/ec2-apply-agent-config.sh`.

| Cérebro | Assunto | Provedor | Modelo (primary) |
|---------|---------|----------|------------------|
| **orchestrator** (Jarvis / Telegram) | Simples / complexo | ollama → deepseek → hf | `smollm2:360m` → `deepseek-v4-flash` → `Qwen2.5-7B:fastest` |
| **macofel, ops, vp-pecas…** | Operações | ollama | `smollm2:360m` |

**Telegram:** operacional → gateway (zero LLM). Conversa **simples** → Ollama. **Complexo** → DeepSeek; se 402, **HF Inference Router** (`docs/HF-INFERENCE-ROUTER.md`).

> **DeepSeek** (`DEEPSEEK_API_KEY`): [api-docs.deepseek.com](https://api-docs.deepseek.com/) — requer saldo (402 se esgotado). **HF Router** cobre fallback complexo com `HF_TOKEN` + [Inference Providers](https://huggingface.co/settings/inference-providers).

---

## Chaves no `.env` (EC2)

```env
# Directas (quotas separadas)
DEEPSEEK_API_KEY=sk-...
GOOGLE_API_KEY=...          # opcional; evitar gemini-3.x pago

# Leque OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...

# Fase 2: chave OR por cérebro (mais isolamento de rate limit)
# OPENROUTER_OPS_KEY=
# OPENROUTER_MACOFEL_KEY=

# HF (inovação, não Telegram)
HF_TOKEN=hf_...
```

Ver `agents/*/config.yaml` → campo `env_key` por cérebro.

---

## Mesma voz, IAs diferentes

Todos os cérebros partilham:

- `POLITICA-SEGURANCA.md`
- `agents/_shared/VOZ-JARVIS.md` (tom PT, curto, sem secrets)
- Orquestrador **agrega** respostas numa mensagem Telegram

O LLM muda; a **persona Jarvis** e as **aprovações** não mudam.

---

## Hugging Face (copiar, não depender)

| O que está no HF | Uso |
|------------------|-----|
| `hf-space/friday-prod` | Pipeline Sophia→Hefestos (smolagents) |
| `hf-space/demo` | Monitor 4 cérebros |
| Spaces públicos (RAG, tools) | Sophia **pesquisa** → Senku decide → portar tool stub para `scripts/` ou EC2 |

**Não** ligar Telegram directo ao HF (latência, cold start). Friday Vercel **orquestra** via `POST /openclaw/orchestrate`.

Padrões a copiar: tools em `hf-space/friday-prod/tools/` → equivalente gateway/skills.

---

## Diagrama

```mermaid
flowchart TB
  TG[Telegram]
  J[Jarvis orchestrator]
  GW[gateway /jarvis]
  DS[(DeepSeek API)]
  OR[(OpenRouter leque)]
  OL[Ollama EC2]
  HF[HF friday-prod]

  TG --> J
  J -->|status github resumo| GW
  J -->|chat raciocinio| DS
  J -->|fallback| OR
  J -->|trivial| OL

  M[macofel] --> OR
  O[ops] --> OR
  S[senku] --> DS
  SP[sophia hefestos] --> HF
  SP -.copiar tools.-> GW
```

---

## Aplicar na EC2

```bash
cd /opt/openclaw
git pull
# .env com DEEPSEEK_API_KEY + OPENROUTER_API_KEY
sudo bash scripts/ec2-apply-agent-config.sh
sudo bash scripts/ec2-fix-telegram-models.sh   # emergência quota Gemini
sudo systemctl restart openclaw-gateway
```

Telegram: `/new` → `ajuda`

---

## Evolução (fase 2)

- `OPENROUTER_<CEREBRO>_KEY` no `.env` — rate limit isolado por agente
- Roteador automático: 429 num provedor → próximo do leque (sem Gemini pago)
- Supabase: histórico + aprovações ([SUPABASE-CENTRAL.md](./SUPABASE-CENTRAL.md))
