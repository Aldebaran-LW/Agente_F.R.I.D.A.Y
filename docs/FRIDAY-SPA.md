# F.R.I.D.A.Y. — SPA cyberpunk (`/friday`)

Painel visual single-page: **Home**, **Sala de Trabalho** (Canvas 2D) e **Rede Neural** (Three.js), ligado ao gateway Vercel com os mesmos endpoints do `/office`.

## URL

| Ambiente | URL |
|----------|-----|
| Produção | `https://agente-openclaw.vercel.app/friday` |
| Local | `http://localhost:3000/friday` (com `vercel dev` na pasta `gateway/`) |

## Autenticação

1. Abre `/friday`.
2. Cola o **`OPENCLAW_AUTOMATION_TOKEN`** (o mesmo da Vercel e do `/office`).
3. **Guardar e sincronizar** — token em `sessionStorage` (`openclaw_office_token`).

Atalho com token na URL (uma vez):

```text
https://agente-openclaw.vercel.app/friday#token=SEU_TOKEN
```

## API

| Rota | Uso na SPA |
|------|------------|
| `GET /api/health` | Indicador gateway |
| `GET /openclaw/office/status` | Status dos 4 cérebros (Bearer) |

Mapeamento API → UI:

| API `id` | UI |
|----------|-----|
| `orchestrator` | Jarvis |
| `macofel` | Macofel |
| `heimdall` | Heimdall |
| `vp-pecas` | VP-Peças |

Fallback: cache `localStorage` (`friday_status_cache`) → depois dados demo.

## Estrutura de ficheiros

```text
gateway/public/friday/
├── index.html
├── css/friday.css
└── js/
    ├── config.js      # constantes, MOCK_AGENTS
    ├── api.js         # FridayAPI
    ├── utils.js       # toast, cursor, swipe
    ├── home.js        # cards + Chart.js
    ├── salaTrabalho.js
    ├── redeNeural.js
    └── main.js        # router #home | #sala | #rede
```

## Deploy

Incluído no deploy Vercel do `gateway/` — `gateway/vercel.json` inclui:

- `builds`: `public/**` → `@vercel/static` (ficheiros estáticos)
- `rewrites`: `/friday` e `/friday/` → `/friday/index.html`

```bash
cd gateway && vercel --prod
```

**Se vires 404:** o domínio de produção pode estar num deploy antigo (antes do commit da SPA). No painel Vercel → **Deployments** → **Redeploy** do `main` mais recente (`c13844d+`). Confirma em `GET /api/health` que o campo `commit` corresponde ao GitHub.

## Mobile

- Cursor neon desactivado em `(hover: none)`.
- Swipe esquerda/direita entre `#home`, `#sala`, `#rede`.
- Menos partículas no Canvas em ecrãs &lt; 768px.

## Funcionalidades recentes

- **Sprites SVG** em `assets/sprites/` (Canvas sala)
- **Hub** — `GET /openclaw/hub/recent` alimenta feed, gráfico 24h e logs na sala
- **CSS2DRenderer** — nomes flutuantes nos nós 3D
- **Duplo-clique** no nó 3D → logs Hub filtrados por agente
- **Pausa** de animações quando o separador está em segundo plano
- **`#metrics`** — KPIs, tabelas, filtro por agente, export CSV/JSON
- **`#playground`** — `POST /jarvis` e `POST /openclaw/orchestrate` (com confirmação)

## Rotas hash

| Hash | Conteúdo |
|------|----------|
| `#home` | Cards, gráfico, feed Hub |
| `#sala` | Canvas 2D |
| `#rede` | Three.js |
| `#metrics` | Dashboard KPIs + export |
| `#playground` | Chat Jarvis / orquestração |

## Playground (segurança)

- Modo **Jarvis**: mensagens normais; checkbox `approved` para acções de escrita
- Modo **Orquestrar**: exige checkbox de confirmação antes de `POST /openclaw/orchestrate`
- Histórico em `sessionStorage` (`friday_playground_history`) — não inclui tokens

## Próximos passos (backlog)

Tubos neon animados nas linhas 3D; gráficos adicionais em métricas (latência EC2).

---

## Prompt evolução (colar na IA)

```text
Contexto: SPA F.R.I.D.A.Y. em gateway/public/friday/ — já integra GET /openclaw/office/status com Bearer (openclaw_office_token).

Prioridade 1 — Dados reais no gráfico Home
- Buscar histórico em GET /openclaw/hub/recent ou agregar snapshots se existirem
- Substituir dados aleatórios do Chart.js por série derivada da API

Prioridade 2 — Personagens SVG
- assets/sprites/{jarvis,macofel,heimdall,vppecas}.svg (64–128px)
- salaTrabalho.js: ctx.drawImage() mantendo balões e partículas

Prioridade 3 — Rede Neural
- CSS2DRenderer com nomes acima dos nós
- Tubos/linhas com gradiente animado
- Double-click → modal com últimos logs (hub/recent filtrado por agent)

Prioridade 4 — Novas rotas hash
- #metrics — KPIs, export CSV
- #playground — POST /openclaw/orchestrate (só com confirmação explícita)

Prioridade 5 — Performance
- Pausar requestAnimationFrame quando document.hidden
- Pool de partículas no Canvas

Manter: sem build step, módulos ES, mesma política de token (nunca hardcoded).
```
