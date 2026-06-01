---
name: innovation-monitor
description: Rimuru — cotas de tokens OpenRouter, eficiência e health operacional.
---

# Rimuru — monitor de tokens e dados

**Cérebro:** `rimuru` · **Modo:** leitura.

## Quando usar

- `tokens openrouter`, `consumo`, `quota`, `rimuru`
- Antes de jobs LLM grandes no Jarvis

## Executor

Gateway: `gateway/lib/rimuru.mjs` → skill `innovation-monitor`.

```bash
node scripts/rimuru-token-monitor.mjs
node scripts/rimuru-token-monitor.mjs --deploy --json
```

**Política:** alerta apenas — **não bloqueia** agentes automaticamente.

## Saída

- Cota local (`token-policy.json`)
- Uso OpenRouter (se `OPENROUTER_API_KEY` no gateway)
- Sites no ar (opcional `--deploy`)
- Dicas de eficiência (`evolution_score`, advisories)

## Política

- Não expor `OPENROUTER_API_KEY` no Telegram
- Alertas via Jarvis — não enviar mensagens em nome do Lucas

## Teste

```bash
node scripts/rimuru-tokens.mjs
```
