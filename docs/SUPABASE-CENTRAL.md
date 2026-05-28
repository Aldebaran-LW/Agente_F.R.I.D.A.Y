# Base de dados central — Supabase vs MongoDB

## Resposta curta

| Base | Papel | Onde vive hoje |
|------|--------|----------------|
| **Supabase (Postgres)** | **Central OpenClaw** — aprovações, audit, sessões, filas, estado de workflows | **Planeado** (`LW_Digital_Forge` / projeto `openclaw-hub`) — **ainda não ligado** a este repo |
| **MongoDB (Atlas)** | **Macofel** — catálogo `products`, contagens, sync imagens | Gateway Vercel (fallback) + API Macofel + scripts locais |
| **Postgres Macofel** | App e-commerce Macofel_2.0 (auth, etc.) | Repo **Macofel_2.0** — **outro** projeto Supabase |

**Sim:** a morada do OpenClaw “central” deve ser **Supabase**, não Mongo.

O orquestrador **não** deve ler Mongo no dia a dia (`docs/ARQUITETURA-AGENTES.md`). Mongo fica nos agentes/API periféricos (Macofel, Render).

## O que guardar no Supabase central (quando implementar)

- `approval_requests` — pedidos “sync”, “deploy”, estado pending/approved
- `workflow_runs` — `traceId`, tasks, latência (complementa audit da Vercel)
- `conversation_sessions` — sessão Telegram por tipo de tarefa
- `snapshots` — último status Macofel/GitHub/deploy (cache operacional)

## Fluxo alvo

```txt
Telegram → EC2 (OpenClaw) → Gateway Vercel → APIs (Macofel, GitHub, …)
                ↓
         Supabase (estado, aprovações, audit)
```

Mongo: só via gateway/Macofel API, nunca como “BD geral” do Jarvis.

## Variáveis (futuro)

No hub `LW_Digital_Forge` / gateway quando existir rota de escrita:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (só servidor — nunca Telegram nem client)

**Não** colocar service role na EC2 se a EC2 só chamar o gateway; preferir gateway como único escritor.
