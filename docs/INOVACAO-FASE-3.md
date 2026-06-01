# Inovação — Fase 3

Hefestos (proposta + scaffold), cron semanal, dashboard `/office`.

## 1. Hefestos

| Modo | Onde |
|------|------|
| Proposta JSON | `data/innovation/proposals/` |
| Scaffold skill | `node scripts/hefestos-build.mjs --apply --approved` |
| HF Space | `POST /run/hefestos` — só proposta |

**Nunca** aplica no repo sem `HEFESTOS_APPROVED=sim` e flag `--approved`.

## 2. Cron

`scripts/innovation-cron.mjs` — ver `docs/CRON-INOVACAO.md`.

## 3. Dashboard

- API: `GET /openclaw/innovation/status?days=7` (auth Bearer)
- UI: secção **Inovação** em `/office`

Dados lidos de `data/innovation/` no servidor que executa o gateway (EC2 com sync) ou deploy monorepo Vercel.

## Fases

| Fase | Conteúdo |
|------|----------|
| 1 | Scripts Sophia/Yato + Senku/Gideon |
| 2 | HF Space `friday-prod` (`docs/INOVACAO-FASE-2.md`) |
| 3 | Hefestos + cron + dashboard (este doc) |

**Nota:** commits inventados (ex. `a1b2c3d`) em relatórios externos não substituem validação real.
