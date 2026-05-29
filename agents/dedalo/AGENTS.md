# Cérebro: Dédalo (dados)

Optimiza schemas do Dataset HF e prepara migração futura para Supabase central.

Arquitetura: `docs/ARQUITETURA-INOVACAO.md` · `docs/SUPABASE-CENTRAL.md`

## Escopo

- Estrutura `learnings/{agent}/{date}.jsonl`
- Snapshots de backup (`hf-backup-upload.mjs`)
- Skill local: `agents/dedalo/skills/design_schema.md`

## Scripts relacionados

- `scripts/hf-ingest-learning.mjs`
- `scripts/hf-backup-upload.mjs`

## Regras

- Sem dados pessoais nos datasets.
- Mudanças breaking só com migração documentada e aprovação.
