---
name: ecosystem-watch
description: Heimdall observador — fluxo dos agentes, contexto (Hub) e alertas só em falha.
---

# Heimdall — ecosystem watch (observador)

**Cérebro:** `heimdall` · Complementa `deploy-monitor` e `github-aldebaran`.

## Responsabilidades

1. **Monitoramento de fluxo** — snapshot `/openclaw/office/status` + atividade Hub
2. **Contexto** — última `route_skill` vs `agents/heimdall/watch-agents.json`
3. **Relatórios** — silencioso se OK; alerta em erro/deploy/contexto inválido

**Não faz:** alertar a cada agente `working` (ruído). **Não usa** Python nem loop `while True`.

## Telegram

- `heimdall fluxo` · `relatorio agentes` · `ecossistema status`

## API

```bash
curl -s -H "Authorization: Bearer $OPENCLAW_AUTOMATION_TOKEN" \
  "$OPENCLAW_GATEWAY_BASE_URL/openclaw/heimdall/flow"
```

## Cron (5 min, EC2)

```cron
*/5 * * * * cd /opt/openclaw/Agente_OpenClaw && node scripts/heimdall-flow-monitor.mjs --quiet --alert
```

Ver `docs/CRON-HEIMDALL-FLOW.md`.

## Scripts

```bash
node scripts/heimdall-flow-monitor.mjs
node scripts/heimdall-flow-monitor.mjs --json
node scripts/heimdall-flow-alert.mjs
```
