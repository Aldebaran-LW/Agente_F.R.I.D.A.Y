---
title: F.R.I.D.A.Y. Prototype
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

**Space unico F.R.I.D.A.Y.** — agentes operacionais + inovacao + painel monitor (ex-openclaw-demo).

- Jarvis/Telegram: EC2 minima (`docs/EC2-MINIMAL.md`)
- Gateway HTTP: Vercel
- Este Space: `POST /run/{agent}`, painel `/`, monitor `/api/status`

Regenerar config: `node scripts/generate-hf-agents-config.mjs`

Deploy: `.\scripts\hf-deploy-space.ps1 -Space friday-prod -ConfigureSecrets`
