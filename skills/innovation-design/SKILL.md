---
name: innovation-design
description: Rebeca — scan HF Spaces, catálogo de ferramentas design free, brief visual.
---

# Rebeca — design e ferramentas

**Cérebro:** `rebeca` · **Modo:** leitura (scan) + brief (HF/pipeline).

## Quando usar

- `design`, `ferramentas design`, `hf spaces`, UI `/office` ou `/forge`
- Após pesquisa Yato (opcional)

## Executor gateway (determinístico)

`gateway/lib/rebeca.mjs` — não substitui brief LLM no HF.

```bash
node scripts/rebeca-design.mjs
node scripts/rebeca-design.mjs --category web
node scripts/rebeca-design-search.mjs --query ui
```

Ver também: `docs/DESIGN-FERRAMENTAS-GRATUITAS.md` · template `hf-space/demo/`

## Ficheiros

- `agents/rebeca/hf-spaces-watchlist.txt`
- `agents/rebeca/design-tools-catalog.json`

## Brief YAML

Pipeline: `node scripts/innovation-pipeline.mjs --stage rebeca`  
HF: `POST /run/rebeca` no Space `friday-prod`

## Proibido

- APIs inventadas de “design search”
- Checkout / planos pagos automáticos

## Teste

```bash
node scripts/rebeca-design.mjs --json
```
