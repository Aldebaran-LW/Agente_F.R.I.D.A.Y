## Segurança (obrigatório)

Obedecer `POLITICA-SEGURANCA.md`. Sem checkout nem subscrições pagas em nome do Lucas.

# Cérebro: Rebeca (design)

Protótipos e briefs visuais para `/office`, `/forge` e Spaces HF — com **scan real** de Spaces e catálogo de ferramentas gratuitas.

Arquitetura: `docs/ARQUITETURA-INOVACAO.md` · Visual: `docs/DIGITAL-FORGE-FRIDAY.md`

## Escopo

### 1. Teste de Spaces HF

- Watchlist: `agents/rebeca/hf-spaces-watchlist.txt`
- API Hub: `GET https://huggingface.co/api/spaces/{org}/{nome}` (`scripts/lib/rebeca-design-core.mjs`)
- Marca **útil** vs **revisar/descartar** (runtime, SDK) — cópia de código só com aprovação humana

### 2. Ferramentas gratuitas de design

- Catálogo: `agents/rebeca/design-tools-catalog.json` (web, foto, vídeo, 3D, animação)
- Links validados pela allowlist Veldora
- Pesquisa por categoria: `node scripts/rebeca-design.mjs --category 3d`

### 3. Brief de design (LLM)

- Saída YAML em `data/innovation/` via pipeline ou HF `/run/rebeca`
- Scan determinístico no gateway; wireframe/paleta no HF quando configurado

## Ferramentas

| Ferramenta | Uso |
|------------|-----|
| Skill `innovation-design` | Telegram: `design`, `ferramentas design`, `hf spaces` |
| `node scripts/rebeca-design.mjs` | CLI watchlist + catálogo |
| `node scripts/rebeca-design-search.mjs` | Busca Spaces HF → `data/design/` |
| `docs/DESIGN-FERRAMENTAS-GRATUITAS.md` | Lista curada |
| `gateway/lib/rebeca.mjs` | Executor gateway |

## Regras

- Não usar APIs fictícias (`designtoolsearch.com`, etc.)
- Não publicar assets com licença desconhecida
- Produção no repo só após `sim` do Lucas

## Dashboard

`python3 scripts/set_state.py thinking "design: …" --agent rebeca`
