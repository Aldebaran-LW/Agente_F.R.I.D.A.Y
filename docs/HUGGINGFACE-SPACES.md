# Hugging Face — Spaces e HF_TOKEN (OpenClaw)

Integracao opcional: demo Space Docker + Dataset privado de backup.
Nao substitui EC2 (Jarvis) nem Vercel (gateway).

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
```

## Rotas do Space

- `/health` — status local
- `/gateway` — health + office/status do gateway Vercel (4 agentes)

## Arquitectura

Telegram/OpenClaw -> EC2 | Secrets Macofel/GitHub -> Vercel | Demo/backup -> HF

## Links

- https://huggingface.co/docs/hub/spaces
- https://huggingface.co/docs/hub/security-tokens