# Heartbeat de infraestrutura

Script: `scripts/heartbeat.py`  
Tarefas autónomas: `scripts/heartbeat-tasks.mjs`

Estratégia: [ESTRATEGIA-CONSCIENCIA-AUTONOMA.md](./ESTRATEGIA-CONSCIENCIA-AUTONOMA.md)

## Checks (infra)

- gateway_service (systemd, só Linux)
- gateway_http (porta 18789)
- telegram (getMe)
- mongodb (opcional, via macofel-count-pending.js)
- host_resources (RAM/disco, só Linux)
- **heimdall_flow** — `node scripts/heimdall-flow-monitor.mjs`
- **autonomous_tasks** — Rimuru quota, gateway produção, GitHub (segundas)

## Tarefas autónomas (`heartbeat-tasks.mjs`)

| Tarefa | Quando | Sem LLM |
|--------|--------|---------|
| `rimuru_quota` | cada heartbeat | ✅ |
| `gateway_prod` | cada heartbeat | ✅ |
| `github_weekly` | segundas UTC | ✅ |

Teste:

```bash
node scripts/heartbeat-tasks.mjs
node scripts/heartbeat-tasks.mjs --json
```

## Variáveis .env

```
TELEGRAM_BOT_TOKEN
TELEGRAM_ADMIN_CHAT_ID
OPENCLAW_GATEWAY_PORT
HEARTBEAT_ALERT_COOLDOWN_SEC=3600
HEARTBEAT_CHECK_GATEWAY=1
HEARTBEAT_CHECK_MONGODB=1
HEARTBEAT_CHECK_HEIMDALL_FLOW=1
HEARTBEAT_TASKS_ENABLED=1
HEARTBEAT_TASK_RIMURU=1
HEARTBEAT_TASK_GATEWAY_PROD=1
HEARTBEAT_TASK_GITHUB_WEEKLY=1
OPENCLAW_GATEWAY_BASE_URL=https://agente-openclaw.vercel.app
RIMURU_DAILY_TOKEN_BUDGET=500000
RIMURU_GATE_DISABLED=0
```

## PC (teste)

```bash
python3 scripts/heartbeat.py --dry-run
```

Sem gateway local:

```bash
HEARTBEAT_CHECK_GATEWAY=0 python3 scripts/heartbeat.py --dry-run
```

## VPS

```bash
sudo bash /opt/openclaw/scripts/install-heartbeat-timer.sh
journalctl -u openclaw-heartbeat.service -n 20
```

Cron alternativo: `*/5 * * * *` — `python3 /opt/openclaw/scripts/heartbeat.py`

## Cron complementar (portfólio)

Ver `docs/CRON-EXEMPLOS.md` — Macofel diário, deploy 6h, inovação semanal.
