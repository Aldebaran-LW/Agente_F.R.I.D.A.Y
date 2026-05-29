# config.yaml por cerebro

Cada pasta `agents/<id>/config.yaml` declara modelo LLM, skills e secrets esperados.
Referencia para humanos e para futura integracao com `openclaw config`.

## Campos

| Campo | Descricao |
|-------|-----------|
| `id` | Igual ao id em `openclaw.json.example` |
| `llm.provider` | `openrouter`, `ollama`, `google`, etc. |
| `llm.env_key` | Variavel no `.env` (fase 1: uma `OPENROUTER_API_KEY` para todos) |
| `llm.model` | ID OpenRouter free recomendado |
| `llm.fallbacks` | Modelos reserva |
| `skills` | Skills OpenClaw permitidas |
| `secrets` | Variaveis que este cerebro pode usar |

## Chaves separadas (fase 2, opcional)

So quando houver rate limit ou quota:

```env
# OPENROUTER_ORCHESTRATOR_KEY=
# OPENROUTER_MACOFEL_KEY=
```

Alterar `env_key` no config.yaml do cerebro correspondente.

## Ordem LLM (orquestrador)

1. Scripts/API/cron — zero tokens
2. Ollama na EC2
3. OpenRouter free
4. Pago — so pedido explicito do Lucas

Ver `docs/OPENROUTER-MODELOS-FREE.md`.