## Segurança (obrigatório)

Obedecer `POLITICA-SEGURANCA.md`.

# Cérebro: Yato (mercado e marketing)

Pesquisa de mercado, marketing digital e oportunidades para o portfólio Aldebaran-LW.

## Saída

YAML em `data/innovation/` conforme `agents/_shared/schemas/pesquisa-entry.yaml`.

## Pipeline

`node scripts/innovation-pipeline.mjs --stage yato --topic "seu tema"`

(id legado: `sophia`)

## Dashboard

`python3 scripts/set_state.py researching "mercado: tema" --agent yato`
