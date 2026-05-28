# Gateway Vercel — deploy do Jarvis

**Projeto unico:** pasta `gateway/` dentro de [Agente_OpenClaw](https://github.com/Aldebaran-LW/Agente_OpenClaw).

Nao usar a raiz do repo como Root Directory na Vercel.

## Passos

1. Vercel → Add Project → repositorio `Agente_OpenClaw`
2. **Root Directory:** `gateway`
3. Environment Variables — copiar de `gateway/.env.example`:

| Variavel | Notas |
|----------|--------|
| `OPENCLAW_AUTOMATION_TOKEN` | Inventar um token forte; repetir no `.env` local OpenClaw |
| `GITHUB_TOKEN` | Opcional mas recomendado |
| `MONGODB_URI` | Fallback status Macofel |
| `MACOFEL_API_BASE` | `https://macofel-2-0.vercel.app` (sem sufixo `/api/import`) |
| `MACOFEL_CATALOG_SECRET` | Do Vercel Macofel, se existir rota status |
| `MACOFEL_URL` / `VP_PECAS_URL` | Health-check |

4. Deploy → anexar dominio `openclaw.lwdigitalforge.com`
5. No PC: `.env` com `OPENCLAW_GATEWAY_BASE_URL` + mesmo token
6. `cd scripts && node check-basico.js`

## Rotas apos deploy

- `GET /api/health` — publico
- `GET|POST /jarvis` — Jarvis (Bearer token)
- `GET /openclaw/macofel/status` — metricas
- `GET /openclaw/github/status` — repos
- `GET /openclaw/deploy/health` — sites

## Erros comuns

| Sintoma | Causa |
|---------|--------|
| 404 em `/jarvis` | Deploy na raiz em vez de `gateway/` |
| 401 | Token diferente entre Vercel e `.env` local |
| Macofel 503 | `MACOFEL_API_BASE` errado (path duplicado) |
| Mongo ECONNREFUSED | Atlas IP / rede; corrigir na Vercel, nao no PC |

Telegram: ver [BASICO-OPENCLAW.md](./BASICO-OPENCLAW.md) fase 2.
