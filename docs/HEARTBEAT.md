# Heartbeat de infraestrutura

Script: `scripts/heartbeat.py`

## Checks

- gateway_service (systemd, so Linux)
- gateway_http (porta 18789)
- telegram (getMe)
- mongodb (opcional, via macofel-count-pending.js)
- host_resources (RAM/disco, so Linux)

## Variaveis .env

TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, OPENCLAW_GATEWAY_PORT,
HEARTBEAT_ALERT_COOLDOWN_SEC (3600), HEARTBEAT_CHECK_GATEWAY, HEARTBEAT_CHECK_MONGODB

## PC (teste)

python3 scripts/heartbeat.py --dry-run

No PC sem gateway: HEARTBEAT_CHECK_GATEWAY=0 python3 scripts/heartbeat.py --dry-run

## VPS

sudo bash /opt/openclaw/scripts/install-heartbeat-timer.sh
journalctl -u openclaw-heartbeat.service -n 20