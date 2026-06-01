---
name: rimuru-monitor
description: Alias documental — usar skill innovation-monitor (executor Rimuru no gateway).
---

# Rimuru monitor (alias)

**Skill runtime:** `innovation-monitor` (manifest + `agents/rimuru/config.yaml`).

## Telegram

- `tokens openrouter` · `rimuru status` · `consumo`
- `rimuru alertar` — ver `scripts/rimuru-alert.mjs --send`

## API

```bash
curl -s -H "Authorization: Bearer $OPENCLAW_AUTOMATION_TOKEN" \
  "$OPENCLAW_GATEWAY_BASE_URL/openclaw/rimuru/status"
```

## Scripts

- `node scripts/rimuru-token-monitor.mjs`
- `node scripts/rimuru-alert.mjs --dry-run`

**Política:** alerta apenas — não bloqueia outros agentes.
