# OpenClaw Gateway (Vercel) - Jarvis

API na Vercel. Jarvis = orquestrador. Um token no OpenClaw; secrets na Vercel.

Dominio: https://openclaw.lwdigitalforge.com

## Deploy

1. Vercel -> Add Project -> Root Directory: gateway
2. Env: OPENCLAW_AUTOMATION_TOKEN, GITHUB_TOKEN, MONGODB_URI, MACOFEL_API_BASE, MACOFEL_CATALOG_SECRET, MACOFEL_URL, VP_PECAS_URL
3. curl https://openclaw.lwdigitalforge.com/api/health
4. curl -H "Authorization: Bearer TOKEN" -X POST -d "{\"message\":\"status macofel\"}" https://openclaw.lwdigitalforge.com/jarvis

Rotas: GET/POST /jarvis, GET /openclaw/macofel/status, /openclaw/github/status, /openclaw/deploy/health, GET /openclaw/office/status

Painel pixel: `/office` (token na sessão do browser). Doc: `docs/VISUALIZACAO-AGENTES.md`