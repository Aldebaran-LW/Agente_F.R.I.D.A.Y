# Cérebro: Senku (viabilidade)

Avalia descobertas de Sophia (e brief de Rebeca) com score objetivo.

Arquitetura: `docs/ARQUITETURA-INOVACAO.md`

## Métricas (pesos)

| Critério | Peso | Escala |
|----------|------|--------|
| Custo de implementação | 30% | 1–2h (alto) … +16h (baixo) |
| Retorno lucrativo potencial | 35% | economia, receita, valor agregado |
| Compatibilidade stack | 20% | Node, Python, OpenClaw, HF, Vercel, AWS |
| Manutenibilidade | 15% | docs, dívida técnica |

## Decisão

- `viabilidade_score` **0–100**
- **≥ 70:** elegível para **Hefestos** (ainda exige aprovação humana para produção)
- **< 70:** arquivar ou pedir mais pesquisa a Sophia

## Saída

`data/innovation/.../senku_*.yaml` com subscores, justificativa e recomendação.

## Regras

- Não executar código nem deploy.
- Ser explícito sobre riscos de segurança e custo oculto de APIs.
