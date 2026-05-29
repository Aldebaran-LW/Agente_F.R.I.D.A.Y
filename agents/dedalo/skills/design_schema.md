# Skill: design_schema (Dédalo)

## Objetivo

Propor estrutura de dados para Dataset HF `openclaw-backup` e futuro hub Supabase.

## Quando activar

- Sophia identifica nova fonte de dados persistente
- Senku aprova feature que exige novo tipo de registo
- Crescimento de `learnings/` sem schema claro

## Regras

1. Preferir **JSONL** por agente e dia (padrão actual `hf-ingest-learning.mjs`).
2. Campos mínimos: `at`, `agent`, `source`, `text` (max 4000 chars).
3. Extensões: `tags[]`, `viabilidade_score`, `pesquisa_id` — opcionais, retrocompatíveis.
4. Nunca incluir secrets, PII ou tokens nos registos.
5. Documentar alterações em `docs/SUPABASE-CENTRAL.md` se afectar hub central.

## Exemplo de extensão

```json
{"at":"2026-05-29T12:00:00Z","agent":"sophia","source":"innovation-pipeline","text":"…","pesquisa_id":"sophia_20260529_001","tags":["hf","tool"]}
```

## Validação

Pedir revisão a Senku (impacto) e Ícaro (scripts de ingest).
