# Cron — Heimdall fluxo (observador)

Monitor **one-shot** Node.js — não usar `heimdall_monitor.py` com `while True` (systemd/cron preferível).

**Integrado ao heartbeat:** `scripts/heartbeat.py` chama `heimdall-flow-monitor.mjs` a cada ciclo do timer systemd (recomendado em produção).

## Intervalo recomendado

| Ambiente | Intervalo | Notas |
|----------|-----------|--------|
| EC2 produção | **5 min** | Alinhado ao heartbeat |
| Dev local | manual | `node scripts/heimdall-flow-monitor.mjs` |

## Crontab (Linux)

```bash
*/5 * * * * cd /opt/openclaw/Agente_OpenClaw && /usr/bin/node scripts/heimdall-flow-monitor.mjs --quiet --alert >> /var/log/openclaw-heimdall.log 2>&1
```

## Inatividade (stale)

Sem atividade no Hub por mais de **60 min** (ajustável):

```bash
# .env na EC2
HEARTBEAT_AGENT_STALE_MIN=60
```

`watch-agents.json` → `stale_minutes` (fallback 45).

## Política de alertas

- **Alerta:** erro de agente, deploy down, violação de contexto (skill errada no Hub)
- **Silencioso:** tudo OK ou só `working` normal
- Telegram: via Jarvis quando `should_notify` — não spam por tarefa

## Relacionado

- `docs/HEARTBEAT.md` — infra VPS
- `agents/heimdall/watch-agents.json` — regras de contexto
- `GET /openclaw/office/status` — painel visual
