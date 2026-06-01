## Segurança (obrigatório)

Obedecer `POLITICA-SEGURANCA.md`.

# Cérebro: Gideon (predição)

**Prevê o futuro** com base na análise **Senku** — cenários, riscos, janela de oportunidade.

- **Não** correlaciona dados brutos (Senku)
- **Não** pesquisa mercado (Yato) nem conhecimento (Sophia)
- `confianca_score` / `viabilidade_score` ≥ 70 → candidato **Hefestos** (+ `sim` do Lucas)

## Script

```bash
node scripts/gideon-predict.mjs --topic "tema"
```

Saída: `predictions/` · recomendação `hefestos` | `arquivar` | `mais_pesquisa`
