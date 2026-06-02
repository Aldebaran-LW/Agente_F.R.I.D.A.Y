# OpenClaw Gateway (Vercel) - Jarvis

API na Vercel. Jarvis = orquestrador. Um token no OpenClaw; secrets na Vercel.

Dominio: https://openclaw.lwdigitalforge.com

## Deploy

Plano Vercel **Hobby**: maximo **12** serverless functions. Rotas `/openclaw/*` usam um unico catch-all (`api/openclaw/[...path].mjs`) — total **3** funcoes (`health`, `jarvis`, `openclaw`).

1. Vercel -> Add Project -> Root Directory: gateway
2. Env: OPENCLAW_AUTOMATION_TOKEN, GITHUB_TOKEN, MONGODB_URI, MACOFEL_API_BASE, MACOFEL_CATALOG_SECRET, MACOFEL_URL, VP_PECAS_URL
3. curl https://openclaw.lwdigitalforge.com/api/health
4. curl -H "Authorization: Bearer TOKEN" -X POST -d "{\"message\":\"status macofel\"}" https://openclaw.lwdigitalforge.com/jarvis

Rotas: GET/POST /jarvis, GET/POST /openclaw/orchestrate (broker EC2/HF), GET /openclaw/macofel/status, /openclaw/github/status, /openclaw/deploy/health, GET /openclaw/office/status

Residências: `docs/MAPAS-RESIDENCIAS.md`

Hub Supabase (opcional): GET /openclaw/hub/health, /openclaw/hub/recent, POST /openclaw/hub/ingest — ver `docs/SUPABASE-CENTRAL.md`

Landing: `/` · Painel pixel: `/office` · SPA cyberpunk: `/friday` · Digital Forge 3D: `/forge` (WS EC2 :8787). Docs: `docs/VISUALIZACAO-AGENTES.md`, `docs/FRIDAY-SPA.md`, `docs/DIGITAL-FORGE-FRIDAY.md`