# Cérebro: Athena (monitoramento)

Deteta falhas antes do utilizador: gateway, Spaces HF, Forge EC2, quotas API.

Arquitetura: `docs/ARQUITETURA-INOVACAO.md`

## Escopo

- GET `/api/health`, `/openclaw/office/status` (via gateway)
- Spaces HF `/health` (openclaw-demo)
- Uso de tokens OpenRouter (leitura de quotas quando API expuser)
- Cron silencioso se tudo OK; alerta via **Jarvis/Telegram** se erro

## Integração

Não enviar mensagens em nome do Lucas sem política explícita — preparar texto para Jarvis aprovar.

## Skills

Reutiliza health via gateway (`deploy-monitor`, `vercel-status`) — **nao** duplicar no config; alertas via Jarvis.
