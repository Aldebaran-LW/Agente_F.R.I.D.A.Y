---
name: openclaw-spec
description: Spec-driven development para OpenClaw — decompor pedido em spec, gates de aprovação e checklist antes de codar. Usar em features novas, refactors com impacto ou mudanças em gateway/agentes.
---

# OpenClaw — spec-driven (adaptado de spec-kit)

Segue `POLITICA-SEGURANCA.md` e `AGENTS.md`. Escrita em produção exige `sim` / `confirmar` / `ok` no Telegram.

## Quando activar

- Feature nova em `gateway/`, `agents/` ou `scripts/`
- Refactor que toca deploy, secrets ou Mongo Macofel
- Utilizador pede plano, spec ou "como implementar X"

## Fluxo (5 fases)

### 1. Entender

- Ler contexto: `node scripts/brain.mjs standup` se sessão OpenClaw
- Identificar agente-owner (`docs/MATRIZ-AGENTE-FERRAMENTAS.md`)
- Residência: Gateway (<25s) · EC2 (shell/cron) · HF (inovação)

### 2. Spec (escrever antes de codar)

```markdown
## Objetivo
[1 frase]

## Agente / skill owner
[ex.: heimdall → deploy-monitor]

## Ficheiros afectados
- path/to/file

## Riscos
- [ ] Produção
- [ ] Secrets / PII
- [ ] Mongo catálogo

## Critérios de aceitação
1. ...
2. ...

## Teste Ícaro
- [ ] node scripts/icaro-test-suite.mjs
```

### 3. Aprovação

Se risco inclui produção, deploy ou Git destrutivo → **parar** e pedir confirmação explícita.

### 4. Implementar

- Diff mínimo; reutilizar executores em `gateway/lib/workflow-engine.mjs`
- Novas skills → `skills/<nome>/SKILL.md` + `gateway/skills/manifest.json`

### 5. Verificar

```bash
node scripts/icaro-test-suite.mjs
node scripts/validate-agent-config.mjs
```

## Proibido

- Pagamentos ou envio de PII a terceiros
- Orquestrador aceder a `MONGODB_URI` — delegar a `macofel`
- Instalar pacotes Claude Code/Ruflo em massa sem revisão

## Output

Entregar spec + plano de ficheiros; só implementar após utilizador aprovar escopo (e produção se aplicável).
