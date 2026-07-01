---
name: openclaw-feature-dev
description: Workflow feature-dev OpenClaw — spec, implementação mínima, Ícaro e gates de aprovação. Usar quando o utilizador pede feature nova, melhoria ou refactor com entrega completa.
---

# OpenClaw — feature-dev (adaptado de wshobson / Command Suite)

Combina `openclaw-spec` + implementação + `openclaw-code-review` + Ícaro.

## Quando activar

- "Implementa X", "adiciona feature Y", "melhora Z"
- Refactor com deploy ou gateway
- Pipeline inovação → Hefestos (código no repo)

## Fluxo (6 passos)

### 1. Contexto

```bash
node scripts/brain.mjs standup
```

- Owner: `docs/MATRIZ-AGENTE-FERRAMENTAS.md`
- Residência: Gateway · EC2 · HF

### 2. Spec curta

Usar template de `.cursor/skills/openclaw-spec/SKILL.md` (objetivo, ficheiros, riscos, critérios).

### 3. Gate Rimuru (se LLM/HF)

- Rotas HF bloqueadas com cota ≥95% (`gateway/lib/rimuru-gate.mjs`)
- Preferir scripts e gateway read-only antes de Sophia/Yato/Hefestos

### 4. Implementar

- Diff mínimo; reutilizar `gateway/lib/workflow-engine.mjs`
- Nova skill → `skills/<nome>/SKILL.md` + `gateway/skills/manifest.json`
- LLM skills → registar em `rimuru-gate.mjs` se delegarem HF

### 5. Verificar

```bash
node scripts/icaro-test-suite.mjs
node scripts/validate-agent-config.mjs
cd gateway && npm test
```

### 6. Review + memória

- Checklist `openclaw-code-review`
- Decisões → `node scripts/brain.mjs dump "..."`
- Produção/deploy → **sim** / **confirmar** no Telegram

## Proibido

- Pagamentos, PII externa, Mongo directo pelo orquestrador
- Instalar Ruflo/216 commands em massa

## Output

Entregar: spec + diff + resultado Ícaro + nota se precisa aprovação produção.
