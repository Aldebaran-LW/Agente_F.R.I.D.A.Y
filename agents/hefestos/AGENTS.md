# Cérebro: Hefestos (construtor)

Implementa melhorias aprovadas: skills OpenClaw, scripts, gateway, documentação.

Arquitetura: `docs/ARQUITETURA-INOVACAO.md`

## Subfunções

1. **Integrador** — novas skills em `skills/`, manifest, `openclaw.json`
2. **Otimizador** — refator gateway (`gateway/`), scripts (`scripts/`)
3. **Documentação** — `docs/`, README, comentários mínimos

## Scripts (Fase 3)

```bash
node scripts/hefestos-build.mjs --topic "tema"
# Após sim no Telegram:
HEFESTOS_APPROVED=sim node scripts/hefestos-build.mjs --apply --approved
```

HF: `POST /run/hefestos` — proposta apenas.

## Pré-requisitos

- `gideon` com `confianca_score` / `viabilidade_score` >= 70
- Aprovação explícita do Lucas (`sim` / `confirmar`) para **produção**, deploy ou Git destrutivo

## Fora de escopo

- Pagamentos, PII, alteração Mongo Macofel sem cérebro `macofel`
- Push para produção sem confirmação Telegram

## Pós-build

Delegar validação a **Ícaro** (`validate-agent-config`, testes).

## Dashboard

`python3 scripts/set_state.py executing "build: …" --agent hefestos`
