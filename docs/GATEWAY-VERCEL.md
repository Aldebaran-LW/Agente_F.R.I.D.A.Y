# Gateway Vercel — API de automacao (nao e o Telegram)

**Papel:** cofre de secrets + rotas HTTP para Macofel, GitHub e health-checks.  
**Jarvis (Telegram, aprovacoes, OpenClaw)** vive na **AWS EC2** — ver [PAPEIS-AWS-VERCEL.md](./PAPEIS-AWS-VERCEL.md).

**Projeto unico:** pasta `gateway/` em [Agente_OpenClaw](https://github.com/Aldebaran-LW/Agente_OpenClaw).  
**Nao** usar a raiz do repo como Root Directory na Vercel.

## Passos

1. Vercel → Add Project → repositorio `Agente_OpenClaw`
2. **Root Directory:** `gateway`
3. **Settings → Security → Deployment Protection**
   - **Vercel Authentication:** OFF (senao `/api/health` da 401)
   - Save
4. Environment Variables — copiar de `gateway/.env.example` (valores reais so no painel Vercel):

| Variavel | Notas |
|----------|--------|
| `OPENCLAW_AUTOMATION_TOKEN` | Token forte; **repetir** no `.env` da EC2/PC. **Nao** confundir com `VERCEL_API_TOKEN` |
| `GITHUB_TOKEN` | Recomendado |
| `MONGODB_URI` | Fallback status Macofel |
| `MACOFEL_API_BASE` | `https://macofel-2-0.vercel.app` (sem sufixo `/api/import`) |
| `MACOFEL_CATALOG_SECRET` | Se existir rota status no Macofel |
| `MACOFEL_URL` / `VP_PECAS_URL` | Health-check |
| `VP_PRECISION_URL` | Health-check (opcional) |

5. Deploy → anexar dominio (ex. `openclaw.lwdigitalforge.com`) **neste** projeto
6. Na EC2 ou PC: `.env` com `OPENCLAW_GATEWAY_BASE_URL` = URL **deste** deploy + mesmo token
7. `cd scripts && node check-basico.js`

## Rotas apos deploy

- `GET /api/health` — publico
- `GET|POST /jarvis` — API orquestrador (Bearer) — chamada pela **AWS**, nao pelo browser anonimo
- `GET /openclaw/macofel/status` — metricas
- `GET /openclaw/github/status` — repos
- `GET /openclaw/deploy/health` — sites
- `GET /openclaw/office/status` — snapshot dos 4 cérebros (painel)
- `GET /office` — painel pixel-art (introduzir token na página)

Visualização completa: [VISUALIZACAO-AGENTES.md](./VISUALIZACAO-AGENTES.md).

## Erros comuns

| Sintoma | Causa |
|---------|--------|
| 404 em `/api/health` | Root Directory nao e `gateway/` ou deploy falhou |
| 401 em tudo (HTML "Authentication Required") | Vercel Authentication ligado no **projeto errado** ou ainda ativo |
| 401 so em `/jarvis` | Token diferente entre Vercel e `.env` EC2 |
| 503 `OPENCLAW_AUTOMATION_TOKEN not configured` | Variavel **com este nome** nao existe no deploy (ou faltou **Redeploy** apos criar) |
| 404 `DEPLOYMENT_NOT_FOUND` no dominio custom | Dominio aponta para projeto/deploy inexistente |
| Macofel 503 | `MACOFEL_API_BASE` errado (path duplicado) |
| Mongo ECONNREFUSED | Atlas IP / rede; corrigir na Vercel |

## URLs: nao misturar projetos

| Host | Tipico problema |
|------|-----------------|
| `openclaw.vercel.app` | Projeto **antigo** — pode ter Authentication ON |
| `agente-openclaw.vercel.app` | Projeto **novo** — usar esta URL no `.env` quando deploy verde |
| `openclaw.lwdigitalforge.com` | So funciona se ligado ao projeto gateway ativo |

Telegram: [BASICO-OPENCLAW.md](./BASICO-OPENCLAW.md) fase 2.
