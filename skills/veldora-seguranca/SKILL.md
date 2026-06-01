---
name: veldora-seguranca
description: Governança Veldora — allowlist de fontes, bloqueio no orchestrate, auditoria e logs no Hub.
---

# Veldora — Segurança e governança

## Papel

Guardião da **verdade** (fontes verificáveis) e **segurança** (sem vazamento de PII/secrets) no ecossistema OpenClaw.

## Responsabilidades

- Validar **prefixos HTTPS** em `agents/veldora/sources-allowlist.txt` antes de encaminhar pesquisa (Yato, Gideon, …)
- Rejeitar prefixos em `agents/veldora/sources-blocklist.txt` (encurtadores, paste)
- Auditar texto/URLs via skill `security-audit` (`node scripts/veldora-audit.mjs`)
- Registar violações no Supabase Hub (`agent_learnings`, `metadata.type: security_audit`)

## Ficheiros

| Ficheiro | Função |
|----------|--------|
| `agents/veldora/sources-allowlist.txt` | Whitelist (prefixo URL) |
| `agents/veldora/sources-blocklist.txt` | Blacklist |
| `agents/veldora/validate-sources.mjs` | API de validação |
| `gateway/lib/veldora-guard.mjs` | Guard no `orchestrate` |

## Comandos Telegram (Jarvis)

| Pedido | Skill / comportamento |
|--------|------------------------|
| `auditoria seguranca` | `security-audit` — audita o texto do pedido |
| `relatorio seguranca` | Idem (roteamento Veldora) |
| URL no pedido a Yato/Gideon | Guard bloqueia se fora da allowlist |

Comandos **futuros** (ainda não implementados no bot): `auditar <agente>`, `bloquear <fonte>`, `permitir <fonte>` — hoje editar os `.txt` no repo.

## Integração

- Gateway: `forwardTask` → `guardOrchestrateForward` → `logSecurityEvent` se bloqueado
- Hub: `persistLearning` com `agent_id: veldora`
- Política global: `POLITICA-SEGURANCA.md` + `politica-seguranca`

## Teste

```bash
node -e "import {isAllowedSource} from './agents/veldora/validate-sources.mjs'; console.log(isAllowedSource('https://github.com/a/b'))"
node scripts/veldora-audit.mjs --url "https://huggingface.co/spaces/foo"
```
