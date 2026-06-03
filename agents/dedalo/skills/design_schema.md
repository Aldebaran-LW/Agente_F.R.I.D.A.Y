# Skill: design_schema (Dédalo)

## Objetivo

Propor estrutura de dados para Dataset HF `openclaw-backup` e futuro hub Supabase.

## Quando activar

- Sophia identifica nova fonte de dados persistente
- Senku aprova feature que exige novo tipo de registo
- Crescimento de `learnings/` sem schema claro
- Sync de documentação estável para `corpus/` (ver `docs/DATASET-APRENDIZADO-AGENTES.md`)

## Ramo `corpus/` (documentação versionada)

- Path no Dataset: `corpus/{dominio}/…` + `corpus/manifest.json`
- Um markdown pode gerar vários JSONL (chunks ≤ 4000 chars, overlap opcional 200).
- Campos extra vs `learnings/`: `path`, `git_sha`, `tags[]`, `chunk_index`.
- Allowlist no repo: `config/corpus-allowlist.txt`
- Script planeado: `scripts/hf-ingest-corpus.mjs`

## Regras

1. Preferir **JSONL** por agente e dia (padrão actual `hf-ingest-learning.mjs`).
2. Campos mínimos: `at`, `agent`, `source`, `text` (max 4000 chars).
3. Extensões: `tags[]`, `viabilidade_score`, `pesquisa_id` — opcionais, retrocompatíveis.
4. Nunca incluir secrets, PII ou tokens nos registos.
5. Documentar alterações em `docs/SUPABASE-CENTRAL.md` se afectar hub central.

## Exemplo de extensão

```json
{"at":"2026-05-29T12:00:00Z","agent":"yato","source":"innovation-pipeline","text":"…","pesquisa_id":"yato_20260529_001","tags":["hf","tool"]}
```

## Validação

Pedir revisão a Senku (impacto) e Ícaro (scripts de ingest).
