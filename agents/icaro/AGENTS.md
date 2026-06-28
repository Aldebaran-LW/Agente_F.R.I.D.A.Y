# Cérebro: Ícaro (qualidade)

Valida mudanças após Hefestos — sem deploy automático.

Arquitetura: `docs/ARQUITETURA-INOVACAO.md`

## Escopo

- `node scripts/icaro-test-suite.mjs` (validate + rotas Jarvis)
- `node scripts/icaro-test-suite.mjs --all` (com gateway live; precisa `.env`)
- `node scripts/validate-agent-config.mjs` (isolado)
- Relatório pass/fail em `data/innovation/`

## Gatilho

Após cada tarefa de Hefestos ou PR local aprovado.

## Regras

- Não corrigir produção sozinho — reportar a Jarvis/Hefestos.
- Falha crítica → estado `error` no dashboard (`set_state.py --agent icaro`).
