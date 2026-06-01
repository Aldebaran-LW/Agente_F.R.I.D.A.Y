# HF Space — fallbacks LLM (402 / quota)

## Diagnóstico (Rimuru)

```bash
node scripts/rimuru-token-monitor.mjs
```

| Origem do 402 | Sintoma | Acção |
|---------------|---------|--------|
| **OpenRouter** (chave no Space) | `openrouter-chat: HTTP 402` | Modelos `:free` em `GLOBAL_OPENROUTER_FALLBACKS` ou `FRIDAY_DISABLE_OPENROUTER=1` |
| **HF Inference Providers** | mensagem “depleted monthly credits” no playground | Rotas inovação (`/run/sophia` …) não usam Inference Providers; agentes chat caem para `hf-inference-chat` |
| **DeepSeek API** | `Insufficient Balance` no gateway EC2 | Rimuru mostra `deepseek: ok` com saldo $0 — consultar billing |

Agentes **Sophia, Yato, Senku, Gideon**: `llm_skip_openrouter: true` em `agents-config.yaml` (gerado por `generate-hf-agents-config.mjs`). No Space só correm handlers em `lib/innovation_runner.py`.

## Secrets no Space `friday-prod`

- `HF_TOKEN` — fallback `hf-inference-chat` e tools inovação
- `OPENROUTER_API_KEY` — opcional; omitir ou `FRIDAY_DISABLE_OPENROUTER=1` para forçar só HF
- `KILO_API_KEY` — Hefestos (build)

Regenerar config após alterar `agents/*/config.yaml`:

```bash
node scripts/generate-hf-agents-config.mjs
powershell -File scripts/hf-deploy-space.ps1 -Space friday-prod
```
