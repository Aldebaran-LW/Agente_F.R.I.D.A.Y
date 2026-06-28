---
name: innovation-test
description: Ícaro — validação pós-mudança (configs, rotas Jarvis, gateway). Modo leitura; reporta falhas sem corrigir produção.
metadata:
  openclaw:
    requires:
      env: []
---

# Ícaro — innovation-test

**Cérebro:** `icaro` (Jarvis roteia; executor no gateway + scripts locais).

## Quando usar

- Após tarefa de Hefestos ou PR local
- `testar agentes`, `validar config`, `icaro` no Telegram
- Antes de merge com alterações em `agents/`, `gateway/skills/manifest.json` ou rotas Jarvis

## Modos

| Modo | Onde | Comando |
|------|------|---------|
| **Gateway lite** | Vercel | skill `innovation-test` via Jarvis |
| **Local quick** | PC / EC2 | `node scripts/icaro-test-suite.mjs` |
| **Local completo** | PC com `.env` | `node scripts/icaro-test-suite.mjs --all` |

## O que corre

1. **Gateway lite** — manifest vs executores em `workflow-engine.mjs`
2. **validate-agent-config.mjs** — ownership skills, secrets, SKILL.md
3. **test-slash-routes.mjs** — normalização Telegram → planner
4. **test-all-logic.mjs** (opcional) — health gateway, rotas openclaw, HF

## Executor (gateway)

Skill `innovation-test` → `gateway/lib/icaro.mjs` (timeout 25s).

## Script local

```bash
node scripts/icaro-test-suite.mjs
node scripts/icaro-test-suite.mjs --all
node scripts/validate-agent-config.mjs
```

Exit code `0` = OK; `1` = falha(s).

## Proibido

- Corrigir produção ou fazer deploy automaticamente
- Ignorar falhas críticas de `politica-seguranca` ou Veldora

## Integração

- Pipeline Hefestos: gatilho `hefestos_complete` em `agents/icaro/config.yaml`
- Falha crítica → reportar a Jarvis; estado `error` no dashboard HF quando aplicável
