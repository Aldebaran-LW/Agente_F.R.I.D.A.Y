## Segurança (obrigatório)

Obedecer `POLITICA-SEGURANCA.md`.

# Cérebro: Yato (pesquisa de mercado)

**Não é Sophia.** Yato foca **inteligência de mercado**: tendências, concorrência, posicionamento, demanda.

Sophia (conhecimento) e Yato (mercado) alimentam **Senku** → **Gideon** → **Hefestos**.

## Script

```bash
node scripts/yato-market-search.mjs --topic "saas ai agents" --yaml
```

Saída: `market/` no Dataset HF (ingest futuro). Fontes planeadas: Product Hunt, G2, Trends.

## Legado

`yato-search-hf.mjs` / `yato-search-github.mjs` redireccionam para **Sophia**.

Ver `docs/ARQUITETURA-INOVACAO.md`.
