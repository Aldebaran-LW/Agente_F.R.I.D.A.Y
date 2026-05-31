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
│ AWS EC2 — executor real              │
│  Jarvis (OpenClaw) · Macofel worker  │
│  Ops/VP cron · Ícaro · Athena        │
│  ec2-orchestrate-hook :8790          │
└──────────────┬───────────────────────┘
               │ HTTPS (webhook)
               ▼
┌──────────────────────────────────────┐
│ Vercel — Friday (gateway)            │
│  /jarvis · /office · /forge          │
│  /openclaw/orchestrate (broker)      │
└──────────────┬───────────────────────┘
               │ POST /run/{agent} (≤8s)
               ▼
┌──────────────────────────────────────┐
│ HF — laboratório (provisório)        │
│  friday-prod: Sophia Rebeca Senku    │
│  Hefestos · Dataset openclaw-backup  │
└──────────────────────────────────────┘
```

---

## Tabela de residências

| Agente / papel | Residência | Runtime | Repo / config |
|----------------|------------|---------|----------------|
| **Jarvis** | AWS EC2 | OpenClaw daemon, Telegram | `agents/orchestrator/` |
| **Macofel** | AWS (+ API) | Catálogo, Mongo, sync | `agents/macofel/` |
| **Ops** (Aldebaran) | AWS EC2 | Cron, scripts GitHub | `agents/ops/` |
| **VP-Pecas** | AWS EC2 | Health, GitHub | `agents/vp-pecas/` |
| **Friday (UI/API)** | Vercel | Serverless gateway | `gateway/` |
| **Friday (memória)** | HF Dataset | `openclaw-backup` | `hf-ingest-learning.mjs` |
| **Sophia, Rebeca, Senku, Hefestos** | HF Space | `friday-prod` (partilhado) | `agents/<id>/` |
| **Dédalo** | HF + scripts | Dataset schema | `agents/dedalo/` |
| **Ícaro, Athena** | AWS EC2 | Testes / monitor | `agents/icaro/`, `athena/` |
| **openclaw-demo** | HF | Monitor apenas | `hf-space/demo/` |

---

## O que cada residência PODE fazer

| Local | Pode | Não pode |
|-------|------|----------|
| **AWS EC2** | Tarefas longas, cron, shell, filas, Telegram | Expor secrets publicamente |
| **Vercel** | Rotear, auth, dashboards, health &lt;10s | Executar jobs longos |
| **HF Space** | Pesquisa, protótipo LLM, ingest Dataset | Mongo Macofel, deploy produção sem ok |

**Regra:** um único **executor com impacto** por tarefa — Friday (Vercel) **encaminha**, não duplica execução.

---

## Roteamento (Friday → EC2 / HF)

### Gateway

```http
POST /openclaw/orchestrate
Authorization: Bearer OPENCLAW_AUTOMATION_TOKEN
Content-Type: application/json

{ "agent": "sophia", "task": "pesquisar tools HF gratuitas para RAG" }
```

`GET /openclaw/orchestrate` — tabela de rotas e endpoints configurados.

### Variáveis Vercel (`gateway/.env`)

```env
# EC2 — webhook Jarvis/Macofel
JARVIS_EC2_WEBHOOK_URL=https://seu-ec2:8790/task
OPENCLAW_EC2_ORCHESTRATE_URL=
OPENCLAW_INTERNAL_TOKEN=

# HF — um Space partilhado (recomendado) ou um URL por agente
HF_FRIDAY_PROD_URL=https://aldebaran-lw-friday-prod.hf.space
HF_SOPHIA_SPACE_URL=
HF_REBECA_SPACE_URL=

ORCHESTRATE_TIMEOUT_MS=8000
```

### EC2

```bash
bash scripts/setup-ec2-hooks.sh          # Forge :8787 + Orchestrate :8790 + ClawMetry :8900
systemctl --user enable --now openclaw-orchestrate
systemctl --user enable --now openclaw-clawmetry   # opcional
sudo bash scripts/install-nginx-ec2-hooks.sh   # HTTPS publico
```

Guia completo: **[EC2-ORCHESTRATE-WEBHOOK.md](./EC2-ORCHESTRATE-WEBHOOK.md)**

URL pública: `https://ec2-hooks.lwdigitalforge.com/orchestrate/task` → `JARVIS_EC2_WEBHOOK_URL` na Vercel.

---

## HF: um Space vs vários

| Modelo | Quando |
|--------|--------|
| **Um Space `friday-prod`** | Recomendado agora — `/run/sophia`, `/run/senku`, etc. |
| **Space por agente** | Só se precisares isolamento GPU/versão |

Dataset: `Aldebaran-LW/openclaw-backup` (nome legado; = “friday-memory” do diagrama).

---

## Promoção HF → produção

1. Sophia/Rebeca no HF geram YAML em `data/innovation/`.
2. Senku `viabilidade_score >= 70`.
3. Lucas aprova no Telegram.
4. Hefestos implementa no **repo**; runtime migra para **EC2** se precisar cron/contínuo.

```yaml
# agents/sophia/config.yaml
deploy:
  mode: hf_space          # provisório
  hf_space: Aldebaran-LW/friday-prod
  promote_to: aws_ec2   # quando estável
```

---

## Checklist

- [ ] EC2: OpenClaw + `ec2-orchestrate-hook.mjs` (:8790)
- [ ] Vercel: secrets + `JARVIS_EC2_WEBHOOK_URL`, `HF_FRIDAY_PROD_URL`
- [ ] HF: `openclaw-demo` com keepalive; `friday-prod` deployed (monitor externo opcional)
- [ ] Dataset `openclaw-backup` privado
- [ ] Teste: `curl -H "Authorization: Bearer …" https://openclaw…/openclaw/orchestrate -d '{"agent":"sophia","task":"teste"}'`

---

## Ver também

- [EC2-ORCHESTRATE-WEBHOOK.md](./EC2-ORCHESTRATE-WEBHOOK.md) — systemd + nginx
- [HF-DEPLOY-FRIDAY.md](./HF-DEPLOY-FRIDAY.md)
- [ARQUITETURA-INOVACAO.md](./ARQUITETURA-INOVACAO.md)
- [ARQUITETURA-AGENTES.md](./ARQUITETURA-AGENTES.md)
