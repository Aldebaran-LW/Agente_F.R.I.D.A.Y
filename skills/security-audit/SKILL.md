---
name: security-audit
description: Auditoria Veldora — política, PII, secrets, veracidade de fontes (URLs e entradas de pesquisa).
metadata:
  openclaw:
    requires:
      env: []
---

# Veldora — auditoria de segurança e veracidade

**Cérebro:** `veldora` (Jarvis roteia; executor no gateway ou script local).

## Responsabilidades

1. **Proteção de dados** — bloquear PII e secrets no texto antes de Telegram/issues/APIs externas (`POLITICA-SEGURANCA.md`).
2. **Fontes de pesquisa** — URLs com prefixo em `agents/veldora/sources-allowlist.txt`, HTTPS obrigatório.
3. **Embasamento** — entradas Yato devem ter `fonte` + `link` verificável; sem isso → `revisar` ou `bloqueado`.

Veldora **não** substitui fact-checking humano nem LLM; aplica regras determinísticas e sinaliza risco.

## Quando usar

- `auditoria seguranca` no Telegram
- Antes de publicar YAML de `data/innovation/` no pipeline
- Revisão de resposta de outro agente (colar texto no pedido)

## Executor (gateway)

Skill `security-audit` → `gateway/lib/veldora.mjs` (timeout 30s).

## Script local

```bash
node scripts/veldora-audit.mjs --text "seu pedido ou resposta"
node scripts/veldora-audit.mjs --url "https://github.com/org/repo"
node scripts/veldora-audit.mjs --file data/innovation/2026-06-01/yato_20260601_001.yaml
node scripts/veldora-audit.mjs --text "..." --json
```

## Vereditos

| Veredito | Significado |
|----------|-------------|
| `aprovado` | Sem falhas; pode seguir fluxo normal |
| `revisar` | Avisos (URL tier2, link em falta, etc.) |
| `bloqueado` | Pagamento, PII, secret ou fonte não confiável |

## Saída estruturada

Esquema: `agents/_shared/schemas/verificacao-entry.yaml`.

## Proibido

- Enviar mensagens em nome do Lucas
- Aprovar pagamentos mesmo com `sim` no chat
- Expor `.env` ou tokens no relatório

## Integração HF

`POST /run/veldora` no Space `friday-prod` para interpretação ambígua; auditoria rápida fica no gateway/script.

## Teste

```bash
node scripts/veldora-audit.mjs --url "https://github.com/Aldebaran-LW/OpenClaw"
node scripts/veldora-audit.mjs --text "status macofel"
```

Exit code `0` = aprovado; `1` = revisar/bloqueado.
