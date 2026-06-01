---
name: hefestos-constructor
description: Hefestos — proposta e scaffold (requer sim para aplicar no repo).
---

# Hefestos — construtor

**Modo:** escrita com **aprovação humana obrigatória** (`POLITICA-SEGURANCA.md`).

## Pré-requisitos

- Gideon `confianca_score` ≥ 70 e `recomendacao: hefestos`
- `sim` / `confirmar` / `ok` do Lucas no Telegram

## Comandos (EC2 / local)

```bash
node scripts/hefestos-build.mjs --topic "tema"
node scripts/hefestos-build.mjs --apply --approved   # HEFESTOS_APPROVED=sim no .env
```

HF Space: `POST /run/hefestos` — devolve **proposta** (não altera o repo Git).

Telegram: `hefestos`, `construir skill`, `implementar melhoria`
