# Basico OpenClaw

Papeis AWS vs Vercel: [PAPEIS-AWS-VERCEL.md](./PAPEIS-AWS-VERCEL.md)

## Nao misturar

| Onde | O que |
|------|--------|
| **AWS EC2** | Jarvis: OpenClaw + Telegram (fase 2) |
| **OpenClaw/** (repo) | Agentes + `.env` minimo (2 chaves gateway) |
| **OpenClaw/gateway/** | Deploy Vercel ONLY — API + secrets |
| **Macofel_2.0** | Outro repo |
| **Telegram** | Fase 2 — so na AWS, nao na Vercel |

## Fase 1

1. Deploy Vercel root=gateway (GATEWAY-VERCEL.md)
2. .env local: OPENCLAW_AUTOMATION_TOKEN + OPENCLAW_GATEWAY_BASE_URL
3. node scripts/check-basico.js

Telegram: depois de tudo verde.