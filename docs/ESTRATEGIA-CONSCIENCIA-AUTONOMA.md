# Estratégia — consciência autónoma de baixo custo

Direção do OpenClaw: assistente autónomo que **percebe, lembra, decide e evolui** com custo próximo de zero, respeitando `POLITICA-SEGURANCA.md`.

Ver também: [ECOSSISTEMA-CLAUDE-CODE.md](./ECOSSISTEMA-CLAUDE-CODE.md) · [OPENROUTER-MODELOS-FREE.md](./OPENROUTER-MODELOS-FREE.md) · [HEARTBEAT.md](./HEARTBEAT.md)

---

## Definição operacional

| Camada | O que é | Custo |
|--------|---------|-------|
| **Perceber** | heartbeat, Heimdall flow, MCP read-only | €0 (sem LLM) |
| **Lembrar** | Obsidian (`brain.mjs`), snapshots `data/`, corpus HF | €0 local |
| **Decidir** | Jarvis orquestrador + Rimuru gate | LLM só se necessário |
| **Agir** | Skills read/write com aprovação Telegram | €0 leitura |
| **Evoluir** | Pipeline Sophia→Gideon→Hefestos + Ícaro | HF free / cron |

**Autonomia** = checks periódicos + alertas sem intervenção humana.  
**Consciência** = estado persistente + roteamento por cérebro.  
**Baixo custo** = ordem scripts → Ollama → OpenRouter `:free`.

---

## O que já está implementado

| Componente | Ficheiro | Função |
|------------|----------|--------|
| Rimuru gate | `gateway/lib/rimuru-gate.mjs` | Bloqueia LLM/HF com cota ≥95% |
| Heartbeat tarefas | `scripts/heartbeat-tasks.mjs` | Rimuru, gateway prod, GitHub semanal |
| Ícaro | `scripts/icaro-test-suite.mjs` | Testes pós-mudança |
| MCP Cursor | `scripts/openclaw-mcp-server.mjs` | Tools read-only no IDE |
| RAG leve local | `scripts/corpus-search-local.mjs`, `brain.mjs search` | Busca docs sem LLM |
| Skills Cursor | `.cursor/skills/openclaw-*` | spec, code-review, feature-dev |
| Vault | `scripts/brain.mjs` | Memória de decisões |

---

## Cherry-pick dos repositórios externos

| Fonte | Adoptar | Ignorar |
|-------|---------|---------|
| **Ruflo** | Cotas, hooks pós-edit | init completo, swarm 50 agentes |
| **feiskyer / wshobson** | spec-kit, feature-dev | 200+ commands |
| **Project N.O.M.A.D.** | Ideia RAG local (fase D) | Servidor sem auth |
| **HashiCorp Nomad** | Jobs EC2 (futuro) | Orquestração de agentes IA |

---

## Stack de custo ~zero

1. Scripts (`macofel-count-pending.js`, `github-repo-status.js`) — zero tokens  
2. Gateway Vercel (hobby) — leitura operacional  
3. Ollama EC2 — chat simples  
4. OpenRouter `:free` — cérebros especializados  
5. HF Spaces free — inovação (cold start aceitável)  
6. Rimuru — bloqueia antes de gastar em excesso  

---

## Roadmap

### Fase A — Sistema acordado ✅ (em curso)

- [x] Rimuru gate no gateway  
- [x] Heartbeat + tarefas autónomas  
- [x] Ícaro executor  
- [x] MCP read-only Cursor  
- [ ] Telegram Fase 2 automático  
- [x] `.cursor/mcp.json` — `node scripts/setup-cursor-mcp.mjs`

### Fase B — Memória que aprende (em curso)

- [x] RAG leve local `scripts/corpus-search-local.mjs`
- [x] `brain.mjs search` integrado
- [x] Allowlist corpus actualizada (estratégia, MCP, heartbeat)
- [x] Jarvis lê corpus antes de rotear HF (`gateway/lib/corpus-context.mjs`)
- [ ] Ingest HF automático pós-promoção docs

### Fase C — Loop de melhoria (em curso)

- [x] Cron semanal `innovation-cron.mjs` + timer systemd
- [x] Gideon ≥70 → proposta + Telegram (`scripts/lib/innovation-notify.mjs`)
- [ ] Hefestos no Cursor após `aprovar proposta`
- [x] Ícaro valida → deploy com **confirmar**

### Fase D — RAG local opcional

- Ollama + Qdrant em host separado (não exposto)  
- Só docs/código OpenClaw — sem PII  

---

## Variáveis relevantes

| Variável | Efeito |
|----------|--------|
| `RIMURU_DAILY_TOKEN_BUDGET` | Cota local diária |
| `RIMURU_GATE_DISABLED=1` | Desactiva gate (debug) |
| `HEARTBEAT_TASKS_ENABLED=1` | Tarefas autónomas no heartbeat |
| `OPENCLAW_GATEWAY_BASE_URL` | Health check produção |

---

## Regras invioláveis

- Pagamentos: **nunca**  
- Produção / deploy / escrita: **sim** / **confirmar**  
- PII e secrets: **nunca** no vault, chat ou corpus  
- Mongo catálogo: só via agente `macofel`  
