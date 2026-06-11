# Papeis: AWS (Jarvis) vs Vercel (Gateway)

Objetivo: **nao misturar** Telegram/cerebro com cofre de APIs na mesma camada.

## Visao rapida

```mermaid
flowchart LR
  subgraph aws [AWS EC2 minima]
    TG[Telegram]
    OC[Jarvis orchestrator]
    TG --> OC
  end

  subgraph vercel [Vercel gateway]
    API[/openclaw/orchestrate]
    JAPI[/jarvis]
  end

  subgraph hf [HF Spaces]
    CORE[openclaw-core]
    INN[openclaw-innovation]
    HFM[macofel-agent]
  end

  subgraph ext [APIs externas]
    MAC[Macofel Render/Vercel]
    GH[GitHub]
  end

  OC -->|Bearer| API
  OC --> JAPI
  API -->|POST /run/agent| CORE
  API --> INN
  API --> HFM
  API --> MAC
  API --> GH
```

| Camada | Onde | Faz o que | Nao faz |
|--------|------|-----------|---------|
| **Jarvis** | AWS EC2 minima (`openclaw`) | Telegram, aprovacoes, chamar gateway | 12 agentes, Ollama, Mongo |
| **Gateway** | Vercel (`gateway/`) | Secrets + broker `/openclaw/orchestrate` | Bot Telegram, jobs longos |
| **Agentes IA** | HF Spaces (3 perfis) | LLM, tools, RAG corpus | Deploy prod, Telegram directo |
| **PC (dev)** | Teu `.env` local | Testar com `check-basico.js` | Producao |

**Regra:** Telegram **nunca** fala com a Vercel diretamente.  
Fluxo: **Telegram → AWS → Gateway → APIs externas**.

---

## Variaveis por ambiente

### Vercel (projeto com Root Directory = `gateway`)

Copiar de `gateway/.env.example`. Tudo que toca Macofel, Mongo, GitHub org, health de sites.

| Variavel | Uso |
|----------|-----|
| `OPENCLAW_AUTOMATION_TOKEN` | Bearer nas rotas protegidas |
| `GITHUB_TOKEN` | `GET /openclaw/github/status` |
| `GITHUB_OWNER` | Owner dos repos |
| `MONGODB_URI` | Fallback status Macofel |
| `MONGODB_DB_NAME` | DB (default `macofel`) |
| `MACOFEL_API_BASE` | API loja (sem `/api/import` duplicado) |
| `MACOFEL_CATALOG_SECRET` | Header catalogo |
| `MACOFEL_URL` | Health-check deploy |
| `VP_PECAS_URL` | Health-check |
| `VP_PRECISION_URL` | Health-check (opcional) |
| `HF_OPENCLAW_CORE_URL` | Space core (Heimdall, VP, …) |
| `HF_OPENCLAW_INNOVATION_URL` | Space innovation (Sophia, …) |
| `HF_MACOFEL_SPACE_URL` | Space macofel-agent |
| `HF_TOKEN` | Auth Spaces privados (orchestrate) |
| `HF_CORPUS_DATASET` | Dataset RAG (`openclaw-backup`) |

**Nao colocar na Vercel:** `TELEGRAM_*`, chaves LLM do Jarvis (ficam na EC2).

### AWS EC2 (`/opt/openclaw/.env` ou equivalente)

Copiar da raiz `.env.example` — secao minima fase 1 + Telegram fase 2.

| Variavel | Fase | Uso |
|----------|------|-----|
| `OPENCLAW_GATEWAY_BASE_URL` | 1 | URL do deploy Vercel (ex. dominio production) |
| `OPENCLAW_AUTOMATION_TOKEN` | 1 | **Mesmo valor** que na Vercel |
| `TELEGRAM_BOT_TOKEN` | 2 | Bot |
| `TELEGRAM_ADMIN_CHAT_ID` | 2 | Teu chat |
| `GOOGLE_API_KEY` / `OPENROUTER_*` / `DEEPSEEK_*` | 2+ | LLM so quando necessario (free tier) |

**Nao precisas na EC2 (fase 1):** `MONGODB_URI`, `MACOFEL_CATALOG_SECRET`, `GITHUB_TOKEN` — o gateway ja tem.

### PC local (desenvolvimento)

Igual EC2 fase 1: so `OPENCLAW_GATEWAY_BASE_URL` + `OPENCLAW_AUTOMATION_TOKEN` para `node scripts/check-basico.js`.

---

## Rotas do gateway (Vercel)

| Rota | Auth | Quem chama |
|------|------|------------|
| `GET /api/health` | Publico | Monitor, browser |
| `GET\|POST /jarvis` | Bearer | AWS OpenClaw (orquestrador) |
| `GET /openclaw/macofel/status` | Bearer | AWS ou scripts |
| `GET /openclaw/github/status` | Bearer | AWS ou scripts |
| `GET /openclaw/deploy/health` | Bearer | AWS ou scripts |
| `GET /openclaw/office/status` | Bearer | Painel pixel, scripts |
| `GET\|POST /openclaw/orchestrate` | Bearer | Broker → HF Spaces / EC2 |
| `GET /office` | Publico (HTML) | Browser — token no sessionStorage |

A rota `/jarvis` e uma **API de delegacao**, nao o processo Telegram. O nome no codigo pode manter-se; o papel e **gateway**.

---

## Fases

1. **Gateway verde** — Vercel deploy + `check-basico.js` OK (sem Telegram).
2. **AWS** — OpenClaw na EC2 com mesmo token/URL; crons opcionais.
3. **Telegram** — pairing no servidor; mensagens vao para OpenClaw, que chama o gateway.
4. **Painel visual** — `/office` na Vercel + Claw3D na EC2. Guia: [VISUALIZACAO-AGENTES.md](./VISUALIZACAO-AGENTES.md).

Deploy Vercel: [GATEWAY-VERCEL.md](./GATEWAY-VERCEL.md). Basico local: [BASICO-OPENCLAW.md](./BASICO-OPENCLAW.md).
