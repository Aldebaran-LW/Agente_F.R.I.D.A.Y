# Inovação — Fase 2 (HF Space `friday-prod`)

Integração **Sophia, Yato, Senku e Gideon** no Space `Aldebaran-LW/friday-prod` para execução via API e orquestração Jarvis (Vercel).

## Antes vs depois

| Fase 1 | Fase 2 |
|--------|--------|
| Scripts só EC2/PC | `POST /run/{agent}` no HF Space |
| Só ficheiros locais `data/innovation/` | Dataset `openclaw-backup` (`knowledge/`, `market/`, `analysis/`, `predictions/`) |
| — | Gateway `POST /openclaw/orchestrate` → HF (timeout 120s inovação) |

## Rotas HF

| Rota | Agente | Função |
|------|--------|--------|
| `POST /run/sophia` | Sophia | `search_knowledge` |
| `POST /run/yato` | Yato | `search_market` |
| `POST /run/senku` | Senku | `analyze` (auto-carrega Sophia+Yato se faltar contexto) |
| `POST /run/gideon` | Gideon | `predict` |
| `POST /run/pipeline` | Pipeline | Sophia → Yato → Senku → Gideon |

Body JSON:

```json
{
  "task": "IA para código",
  "context": { "topic": "IA para código", "source": "jarvis" }
}
```

## Variáveis (Space + Vercel)

| Variável | Onde |
|----------|------|
| `HF_TOKEN` | Space + Vercel (orchestrate) |
| `HF_BACKUP_DATASET` | `Aldebaran-LW/openclaw-backup` |
| `GITHUB_TOKEN` | Space (rate limit GitHub) |
| `HF_FRIDAY_PROD_URL` | Vercel — base do Space |
| `ORCHESTRATE_INNOVATION_TIMEOUT_MS` | Vercel — default `120000` |
| `GIDEON_THRESHOLD` | Space — default `70` |

## Testar localmente (antes do deploy)

```powershell
cd hf-space/friday-prod
pip install -r requirements.txt
$env:HF_TOKEN = "hf_..."   # opcional para Dataset
uvicorn app:app --port 7860
```

```powershell
curl -X POST http://127.0.0.1:7860/run/sophia `
  -H "Content-Type: application/json" `
  -d '{"task":"openclaw agents"}'
```

Scripts Node equivalentes (EC2): `docs/ARQUITETURA-INOVACAO.md`

## Deploy

1. Regenerar config: `node scripts/generate-hf-agents-config.mjs`
2. Push do repo do Space (ou sync `hf-space/friday-prod` para o repositório HF)
3. Aguardar rebuild do Space
4. `GET https://aldebaran-lw-friday-prod.hf.space/health`
5. Vercel: confirmar `HF_FRIDAY_PROD_URL` + `HF_TOKEN`

**Não há commit `7c3f9a1` automático** — fazer commit/push só quando o Lucas pedir.

## Telegram (Jarvis)

Frases que o router encaminha:

- `pesquisa conhecimento …` → Sophia
- `pesquisa mercado …` → Yato
- `analisar tendencias` → Senku
- `previsao …` → Gideon

Política: Hefestos só com score ≥ 70 + `sim`/`confirmar` (`POLITICA-SEGURANCA.md`).
