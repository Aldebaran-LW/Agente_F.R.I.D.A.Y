---
name: openclaw-brain
description: Segundo cérebro OpenClaw — standup, dump, wrap-up e weekly no vault Obsidian (Celebro LW).
metadata:
  openclaw:
    requires:
      env:
        - OPENCLAW_BRAIN_VAULT
---

# openclaw-brain — segundo cérebro (vault Obsidian)

**Cérebro:** `orchestrator` (memória operacional; não substitui `POLITICA-SEGURANCA`).

## Vault

- Caminho: `OPENCLAW_BRAIN_VAULT` no `.env` (ex.: `H:\Meu Drive\Projetos\Celebro LW`)
- Leitura obrigatória no início de sessões OpenClaw: `brain/North Star.md`
- Nota diária: `daily/YYYY-MM-DD.md`

## Comandos (OpenClaw-native, sem `/om-*`)

| Momento | Comando |
|---------|---------|
| Manhã | `node scripts/brain.mjs standup` |
| Algo aconteceu | `node scripts/brain.mjs dump "texto livre"` |
| Fim do dia | `node scripts/brain.mjs wrap-up` |
| Semanal | `node scripts/brain.mjs weekly` |

## Fluxo do agente

1. **Standup** — correr script; resumir foco em português (máx. 8 linhas).
2. **Dump** — utilizador descreve em frases simples; agente:
   - regista com `brain.mjs dump`
   - cria/atualiza notas em `projects/`, `people/`, `brain/Key Decisions.md` quando relevante
   - liga com wikilinks `[[projects/...]]`, `[[people/...]]`
3. **Wrap-up** — correr script; fechar links soltos na daily; sugerir promoção de notas maduras para `docs/` no repo OpenClaw.
4. **Promoção** — nota madura → `OpenClaw/docs/` + entrada em `config/corpus-allowlist.txt` + `node scripts/hf-ingest-corpus.mjs`

## Proibido

- Secrets, tokens ou PII em notas do vault.
- Ações de impacto só com aprovação Telegram (`POLITICA-SEGURANCA.md`).

## Erros

- Vault não encontrado: pedir `OPENCLAW_BRAIN_VAULT` no `.env`.
- QMD opcional no PC; RAG canónico continua no corpus HF.
