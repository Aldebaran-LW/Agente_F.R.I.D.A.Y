# Hugging Face — Spaces e HF_TOKEN (OpenClaw)

Integracao opcional: demo Space Docker + Dataset privado de backup.
Nao substitui EC2 (Jarvis) nem Vercel (gateway).

**Guia completo de deploy:** [`HF-DEPLOY-FRIDAY.md`](./HF-DEPLOY-FRIDAY.md)

## Recursos configurados

| Recurso | URL |
|---------|-----|
| Space demo (privado) | https://huggingface.co/spaces/Aldebaran-LW/openclaw-demo |
| App URL | https://aldebaran-lw-openclaw-demo.hf.space |
| Dataset backup (privado) | https://huggingface.co/datasets/Aldebaran-LW/openclaw-backup |

Secrets no Space (via hf-configure-space.mjs):
- OPENCLAW_GATEWAY_BASE_URL
- OPENCLAW_AUTOMATION_TOKEN

## Variaveis .env

```env
HF_TOKEN=
HF_SPACE_REPO=Aldebaran-LW/openclaw-demo
HF_BACKUP_DATASET=Aldebaran-LW/openclaw-backup
```

## Scripts

```powershell
node scripts/test-hf-token.mjs
node scripts/hf-configure-space.mjs
node scripts/hf-backup-upload.mjs
node scripts/generate-hf-agents-config.mjs
```

## Spaces

| Space | Pasta repo | URL app |
|-------|------------|---------|
| `openclaw-demo` | `hf-space/demo/` | https://aldebaran-lw-openclaw-demo.hf.space |
| `friday-prod` (criar) | `hf-space/friday-prod/` | protótipo smolagents |

## Rotas do Space demo

- `/` — painel HTML (4 cérebros, refresh 60s)
- `/health` — status local (monitor externo opcional: cron-job.org, cron EC2)
- `/api/status` — JSON agregado
- `/gateway` — health + office/status do gateway Vercel

## Keepalive (sem UptimeRobot)

O demo usa **keepalive interno**: `KEEPALIVE_MS=240000` (4 min) em `hf-space/demo/server.mjs` — não precisa de serviço pago. Para alertas se o Space cair, ver [HF-DEPLOY-FRIDAY.md](./HF-DEPLOY-FRIDAY.md) §5 (cron-job.org ou EC2).

## Arquitectura

Telegram/OpenClaw -> EC2 | Secrets Macofel/GitHub -> Vercel | Demo/backup -> HF

## Links

- https://huggingface.co/docs/hub/spaces
- https://huggingface.co/docs/hub/security-tokens