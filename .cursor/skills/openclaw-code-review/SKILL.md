---
name: openclaw-code-review
description: Code review estruturado para o repo OpenClaw — qualidade, segurança (POLITICA-SEGURANCA), executores gateway e convenções multi-agente. Usar em PRs, diffs ou pedidos de revisão.
---

# OpenClaw — code review

Complementa `security-audit` (Veldora). Foco: **código + arquitectura + executores**.

## Quando activar

- PR ou diff pedido pelo utilizador
- Antes de merge em `gateway/`, `agents/`, `scripts/`
- Após feature grande (com `openclaw-spec`)

## Checklist (ordem fixa)

### 1. Segurança (`POLITICA-SEGURANCA.md`)

- [ ] Sem secrets, tokens ou `.env` no diff
- [ ] Sem pagamentos ou checkout automatizado
- [ ] Escritas com impacto têm gate de aprovação (`requiresApproval` no manifest)
- [ ] Orquestrador não importa Mongo / catálogo directo

### 2. Arquitectura hub-spoke

- [ ] Agente certo no manifest (`agent-owner`)
- [ ] Executor na residência certa (Gateway vs EC2 vs HF)
- [ ] Agentes não se chamam — Jarvis consolida workflows

### 3. Executores

- [ ] Skill nova tem entrada em `gateway/skills/manifest.json`
- [ ] Se executa no gateway → função em `workflow-engine.mjs` / `gateway/lib/*.mjs`
- [ ] `innovation-test` passa: `node scripts/icaro-test-suite.mjs`

### 4. Qualidade

- [ ] Diff mínimo; sem refactor não pedido
- [ ] Convenções existentes (ESM, `.mjs`, nomes dos agentes)
- [ ] Sem paths absolutos Windows hard-coded (preferir env / relativos)

### 5. Documentação

- [ ] `SKILL.md` actualizado se skill mudou
- [ ] Decisões relevantes → `node scripts/brain.mjs dump "..."` (vault)

## Formato da resposta

```markdown
## Veredito
[aprovado | revisar | bloqueado]

## Bloqueadores
- ...

## Sugestões
- ...

## Segurança (Veldora)
[opcional: node scripts/veldora-audit.mjs --text "..." se texto sensível]
```

## Vereditos

| Veredito | Significado |
|----------|-------------|
| **aprovado** | Pode seguir merge/deploy (com aprovação se produção) |
| **revisar** | Avisos; corrigir antes de produção |
| **bloqueado** | Viola política ou falta executor — não merge |

## Proibido

- Aprovar merge em produção sem confirmação do Lucas
- Expor PII ou tokens no comentário de review
