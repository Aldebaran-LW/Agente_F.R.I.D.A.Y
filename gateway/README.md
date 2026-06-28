# OpenClaw Gateway (Vercel) - Jarvis

API na Vercel. Jarvis = orquestrador. Um token no OpenClaw; secrets na Vercel.

Dominio: https://openclaw.lwdigitalforge.com

## Deploy

Plano Vercel **Hobby**: maximo **12** serverless functions. Rotas `/openclaw/*` usam catch-all (`api/openclaw-router.mjs`).

**Importante:** Root Directory no painel Vercel = `gateway` (relativo ao repo). Deploy **sempre da raiz do repo**:

```powershell
cd "H:\Meu Drive\Projetos\OpenClaw"
npx vercel link --yes --project agente-openclaw   # uma vez
npx vercel deploy --prod --yes
```

Nao fazer deploy de dentro de `gateway/` (duplicava path `gateway/gateway` e quebrava com 500).

Build: `npm run vercel-build` (prepare + validacao UTF-8 dos `.mjs`). Nunca manter pasta `gateway/gateway/` (legado UTF-16).

1. Vercel -> Root Directory: `gateway`
2. Env: OPENCLAW_AUTOMATION_TOKEN, GITHUB_TOKEN, ...
3. `curl https://agente-openclaw.vercel.app/api/health`
4. MCP read-only: `docs/MCP-CURSOR-OPENCLAW.md`

Rotas: GET/POST /jarvis, GET/POST /openclaw/orchestrate (broker EC2/HF), GET /openclaw/macofel/status, /openclaw/github/status, /openclaw/deploy/health, GET /openclaw/office/status

Residências: `docs/MAPAS-RESIDENCIAS.md`

Hub Supabase (opcional): GET /openclaw/hub/health, /openclaw/hub/recent, POST /openclaw/hub/ingest — ver `docs/SUPABASE-CENTRAL.md`

Landing: `/` · Painel pixel: `/office` · SPA cyberpunk: `/friday` · Digital Forge 3D: `/forge` (WS EC2 :8787). Docs: `docs/VISUALIZACAO-AGENTES.md`, `docs/FRIDAY-SPA.md`, `docs/DIGITAL-FORGE-FRIDAY.md`