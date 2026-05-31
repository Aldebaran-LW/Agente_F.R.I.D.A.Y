# Arquitetura dos agentes — OpenClaw (hub & spoke)

**Âmbito:** apenas este workspace (`OpenClaw`). Outros projetos (hub Supabase) ficam fora até decisão explícita.

## Papéis

| Camada | Quem | Dados / integrações |
|--------|------|---------------------|
| **Central** | `orchestrator` | Telegram, aprovações, delegação. **Não** acede a MongoDB de catálogo. |
| **Periférico Macofel** | `macofel` | Catálogo: API Macofel, gateway Vercel, ou script Mongo (fallback dev). |
| **Periférico VP** | `vp-pecas` | Sites usinagem, GitHub, health-check. |
| **Periférico Ops** | `ops` | GitHub org, Vercel deploy, cron. |
| **Inovação** | `sophia`, `rebeca`, `senku`, `hefestos` | Pesquisa → design → viabilidade → build. Ver [ARQUITETURA-INOVACAO.md](./ARQUITETURA-INOVACAO.md). |
| **Suporte** | `icaro`, `athena`, `dedalo` | Testes, monitor, schemas HF. |

## Fluxo de pedidos

Utilizador (Telegram) -> orquestrador -> macofel | vp-pecas | ops -> skills + scripts

## Ordem de leitura Macofel (`macofel-status`)

1. Gateway: GET {OPENCLAW_GATEWAY_BASE_URL}/openclaw/macofel/status + Bearer token
2. API Macofel: GET {MACOFEL_API_BASE}/api/admin/catalog/status
3. Script: node scripts/macofel-status.js (fallback)

O orquestrador delega ao cérebro `macofel` — não corre Mongo diretamente.

## Secrets no `.env`

| Variável | Quem usa |
|----------|----------|
| OPENCLAW_AUTOMATION_TOKEN, OPENCLAW_GATEWAY_BASE_URL | Gateway (todos, quando existir rota) |
| MONGODB_URI, MACOFEL_* | Cérebro macofel apenas |
| GITHUB_TOKEN | ops, vp-pecas, orquestrador (leitura) |
| VERCEL_API_TOKEN | ops, vp-pecas |

## Futuro (hub central)

**Supabase** como BD do OpenClaw central (aprovações, workflows, audit). **Mongo** permanece no Macofel/API periféricos. Detalhe: [SUPABASE-CENTRAL.md](./SUPABASE-CENTRAL.md).

OpenClaw deixa `MONGODB_URI` no orquestrador quando o gateway expuser todo o status Macofel.

## Config por cérebro (`config.yaml`)

Cada pasta `agents/<id>/` inclui **`config.yaml`**: modelo LLM (OpenRouter free), skills e secrets esperados.

| Ficheiro | Modelo recomendado |
|----------|-------------------|
| `agents/orchestrator/config.yaml` | Nemotron 3 Super (free) |
| `agents/macofel/config.yaml` | DeepSeek V4 Flash (free) |
| `agents/ops/config.yaml` | Laguna M.1 (free) |
| `agents/vp-pecas/config.yaml` | MiniMax M2.5 (free) |

Esquema: `agents/_shared/CONFIG-SCHEMA.md`. Validar: `node scripts/validate-agent-config.mjs`.

**Matriz papel → skill → executor (diagnóstico):** [MATRIZ-AGENTE-FERRAMENTAS.md](./MATRIZ-AGENTE-FERRAMENTAS.md)

**Residências:** gateway (API rápida) · EC2 (cron/scripts longos) · HF (inovação). Ver [MAPAS-RESIDENCIAS.md](./MAPAS-RESIDENCIAS.md).

**Dados cruzados:** agentes não se chamam — Jarvis pede, consolida, devolve (workflows multi-step).

Fase 1: uma `OPENROUTER_API_KEY` partilhada (`llm.env_key`). Chaves por cérebro só se houver rate limit.
