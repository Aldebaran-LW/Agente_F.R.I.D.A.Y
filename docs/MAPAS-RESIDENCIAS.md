# Mapa de residências — F.R.I.D.A.Y. / OpenClaw

Onde cada componente **mora** (runtime) vs onde está **definido** (repo `agents/`).

Política: `POLITICA-SEGURANCA.md` · Roteamento: `POST /openclaw/orchestrate` (gateway Vercel).

---

## Diagrama

```
Telegram
   │
   ▼
┌──────────────────────────────────────┐
│ AWS EC2 mínima                       │
│  Jarvis (orchestrator) + heartbeat   │
└──────────────┬───────────────────────┘
               │ HTTPS /jarvis
               ▼
┌──────────────────────────────────────┐
│ Vercel — gateway OpenClaw            │
│  /jarvis · /office · /forge          │
│  /openclaw/orchestrate (broker)      │
└──────────────┬───────────────────────┘
               │ POST /run/{agent}
               ▼
┌─────────────────────────────────────────────────────────┐
│ HF Spaces (3 perfis)                                    │
│  openclaw-core      — Heimdall, VP, Veldora, Rimuru…   │
│  openclaw-innovation — Sophia, Yato, Senku, Gideon…     │
│  macofel-agent      — Macofel (instância separada)      │
│  Dataset openclaw-backup/corpus — RAG docs              │
└─────────────────────────────────────────────────────────┘
```

---

## Tabela de residências

| Agente / papel | Residência | Runtime | Repo / config |
|----------------|------------|---------|----------------|
| **Jarvis** | AWS EC2 | OpenClaw daemon, Telegram | `agents/orchestrator/` |
| **Macofel** | HF Space | `macofel-agent` | `agents/macofel/` |
| **Heimdall, VP-Pecas, Veldora, Rimuru, Dédalo, Ícaro** | HF Space | `openclaw-core` | `agents/<id>/` |
| **Sophia, Yato, Senku, Gideon, Hefestos, Rebeca** | HF Space | `openclaw-innovation` | `agents/<id>/` |
| **Friday (UI/API)** | Vercel | Serverless gateway | `gateway/` |
| **Memória / corpus** | HF Dataset | `openclaw-backup/corpus/` | `scripts/hf-ingest-corpus.mjs` |
| **Catálogo Python Macofel** | Render | API Mongo (legado) | repo Macofel_2.0 |

---

## O que cada residência PODE fazer

| Local | Pode | Não pode |
|-------|------|----------|
| **AWS EC2** | Telegram, aprovações, heartbeat | Executar 12 agentes / Ollama pesado |
| **Vercel** | Rotear, auth, dashboards, health &lt;10s | Executar jobs longos |
| **HF Space** | LLM, tools, RAG corpus, protótipos | Mongo Macofel, deploy prod sem ok |

**Regra:** Vercel **encaminha**; um executor por tarefa.

---

## Roteamento (gateway → HF)

### Gateway

```http
POST /openclaw/orchestrate
Authorization: Bearer OPENCLAW_AUTOMATION_TOKEN
Content-Type: application/json

{ "agent": "sophia", "task": "pesquisar tools HF gratuitas para RAG" }
```

`GET /openclaw/orchestrate` — tabela de rotas e endpoints.

### Variáveis Vercel (`gateway/vercel.json` + painel)

```env
HF_OPENCLAW_CORE_URL=https://aldebaran-lw-openclaw-core.hf.space
HF_OPENCLAW_INNOVATION_URL=https://aldebaran-lw-openclaw-innovation.hf.space
HF_MACOFEL_SPACE_URL=https://aldebaran-lw-macofel-agent.hf.space
HF_CORPUS_DATASET=Aldebaran-LW/openclaw-backup
HF_TOKEN=...
OPENCLAW_AUTOMATION_TOKEN=...

# Só Jarvis (Telegram na EC2)
JARVIS_EC2_WEBHOOK_URL=
ORCHESTRATE_INNOVATION_TIMEOUT_MS=120000
```

URLs de perfil são **base** do Space; o gateway acrescenta `/run/{agent}`.

### EC2 mínima

```powershell
.\scripts\ec2-sync-from-pc.ps1
```

Por defeito aplica `EC2_PROFILE=minimal` (só orchestrator). Ver `docs/EC2-MINIMAL.md`.

---

## HF: perfis de Space

| Perfil | Repo HF | Agentes |
|--------|---------|---------|
| `core` | `Aldebaran-LW/openclaw-core` | heimdall, vp-pecas, veldora, rimuru, dedalo, icaro |
| `innovation` | `Aldebaran-LW/openclaw-innovation` | sophia, yato, senku, gideon, hefestos, rebeca |
| `macofel` | `Aldebaran-LW/macofel-agent` | macofel |

Mapa fonte: `config/hf-space-profiles.yaml`

Deploy: `node scripts/hf-deploy-space.mjs --profile <id> --secrets`

---

## Promoção HF → produção

1. Agentes innovation geram YAML em `data/innovation/`.
2. Senku `viabilidade_score >= 70`.
3. Lucas aprova no Telegram.
4. Hefestos implementa no **repo**; runtime permanece no HF até decisão explícita.

```yaml
# agents/macofel/config.yaml
deploy:
  mode: hf_space
  hf_space: Aldebaran-LW/macofel-agent
```

---

## Checklist

- [x] Vercel: `HF_OPENCLAW_*_URL` + roteamento por perfil
- [x] HF: 3 Spaces deployed
- [x] EC2: só orchestrator (`ec2-slim-essential`)
- [ ] Disco EC2 &lt;90% (EBS 8→16 GB se necessário — `docs/EC2-DISCO.md`)
- [ ] Teste: `node scripts/test-hf-spaces-routing.mjs`

---

## Ver também

- [EC2-MINIMAL.md](./EC2-MINIMAL.md)
- [HF-DEPLOY-FRIDAY.md](./HF-DEPLOY-FRIDAY.md)
- [GATEWAY-VERCEL.md](./GATEWAY-VERCEL.md)
- [DATASET-APRENDIZADO-AGENTES.md](./DATASET-APRENDIZADO-AGENTES.md)
