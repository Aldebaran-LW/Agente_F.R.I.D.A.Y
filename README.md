# Agente_OpenClaw (F.R.I.D.A.Y. / Jarvis)

Rede multi-agente da [Aldebaran-LW](https://github.com/Aldebaran-LW) para alertas, rotinas e integracoes (Macofel, GitHub, deploy). **Acoes com impacto exigem aprovacao no Telegram.**

Repo: [github.com/Aldebaran-LW/Agente_OpenClaw](https://github.com/Aldebaran-LW/Agente_OpenClaw)

## Arquitetura

```mermaid
flowchart LR
  TG[Telegram] --> EC2[OpenClaw EC2]
  EC2 --> GW[Vercel Gateway]
  GW --> MAC[Macofel / Mongo]
  GW --> GH[GitHub]
  HF[HF Space demo] -.->|read-only| GW
```

| Camada | Onde | Funcao |
|--------|------|--------|
| **Jarvis + Telegram** | AWS EC2 | Conversa, aprovacoes, cron |
| **Gateway** | Vercel `gateway/` | Secrets + API `/jarvis`, `/openclaw/*` |
| **Cerebros** | `agents/*` | Especialistas (Macofel, Ops, VP-Pecas) |
| **HF (opcional)** | Hugging Face | Demo + backup JSON |

Detalhe: `docs/PAPEIS-AWS-VERCEL.md` · `docs/ARQUITETURA-AGENTES.md`

## Cerebros e modelos (free)

Cada cerebro tem `agents/<id>/config.yaml` (modelo OpenRouter recomendado):

| ID | Papel | Modelo free |
|----|-------|-------------|
| `orchestrator` | Jarvis | `nvidia/nemotron-3-super-120b-a12b:free` |
| `macofel` | Catalogo | `deepseek/deepseek-v4-flash:free` |
| `ops` | GitHub/deploy | `poolside/laguna-m.1:free` |
| `vp-pecas` | Sites usinagem | `minimax/minimax-m2.5:free` |

Fase 1: **uma** `OPENROUTER_API_KEY` para todos. Ver `docs/OPENROUTER-MODELOS-FREE.md`.

## Setup rapido (PC)

```powershell
copy .env.example .env
# Preencher OPENCLAW_AUTOMATION_TOKEN + OPENCLAW_GATEWAY_BASE_URL

.\run-basico.ps1
# ou: cd scripts; node check-basico.js
```

Deploy gateway: `docs/GATEWAY-VERCEL.md` (Root Directory = `gateway`).

## Testes

```powershell
.\run-basico.ps1              # gateway + Jarvis + 4 agentes
.\run-tests.ps1               # chaves, Telegram, GitHub
node scripts/validate-agent-config.mjs
node scripts/test-hf-token.mjs   # opcional HF
```

## Pastas principais

| Pasta | Conteudo |
|-------|----------|
| `agents/` | Cerebros + `config.yaml` + `AGENTS.md` |
| `gateway/` | API Vercel (Jarvis, Macofel status, office, forge) |
| `skills/` | Skills OpenClaw |
| `scripts/` | Cron, heartbeat, HF, dashboards |
| `hf-space/demo/` | Space Docker Hugging Face |
| `docs/` | Documentacao completa |

## Seguranca

Ler primeiro: **`POLITICA-SEGURANCA.md`** — pagamentos e PII proibidos; producao so com `sim`/`confirmar`.

## Sync Drive / GitHub

- Drive: `G:\Meu Drive\Projetos\OpenClaw`
- Git local: `C:\Users\LUCAS_W\Documents\GitHub\Agente_OpenClaw`
- Sync: `.\sync-workspaces.ps1`

## Links uteis

- Painel pixel: `{OPENCLAW_GATEWAY_BASE_URL}/office`
- Digital Forge 3D: `{OPENCLAW_GATEWAY_BASE_URL}/forge`
- HF Space demo: `docs/HUGGINGFACE-SPACES.md`
- Domínio custom: Vercel → Domains → `f.r.i.d.a.y.lwdigitalforge.com` (ou `openclaw.lwdigitalforge.com`)