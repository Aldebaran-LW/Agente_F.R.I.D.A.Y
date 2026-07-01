# Cron — pipeline de inovação (semanal)

## Script

```bash
node scripts/innovation-cron.mjs
node scripts/innovation-cron.mjs --dry-run
node scripts/innovation-cron.mjs --notify-only   # reenvia Telegram do último Gideon
```

Executa: `sophia-research` → `yato-market-search` → `senku-process` → `gideon-predict`.

Log: `data/innovation/cron-last.json`

## Fase C — alerta + proposta

Se Gideon `confianca_score` ≥ `GIDEON_THRESHOLD` (70) e `recomendacao: hefestos`:

1. Regista proposta em `data/proposals-pending.json`
2. Envia Telegram ao `TELEGRAM_ADMIN_CHAT_ID` (se configurado)
3. **Não** executa Hefestos — aprovação humana obrigatória

Comandos no Telegram:

- `propostas` — lista pendentes
- `aprovar proposta <id>` — aprova (Jarvis/gateway)
- `rejeitar proposta <id> motivo` — rejeita

## Variáveis (.env)

| Variável | Default |
|----------|---------|
| `INNOVATION_TOPIC_SOPHIA` | `IA devtools agentes openclaw` |
| `INNOVATION_TOPIC_YATO` | `automação SaaS IA mercado` |
| `GIDEON_THRESHOLD` | `70` |
| `INNOVATION_CRON_NOTIFY` | `1` (0 desactiva Telegram) |
| `TELEGRAM_BOT_TOKEN` | — |
| `TELEGRAM_ADMIN_CHAT_ID` | — |

## EC2 (segunda-feira 8h)

Timer systemd (recomendado):

```bash
sudo OPENCLAW_WORKSPACE=/opt/openclaw bash scripts/install-innovation-timer.sh
journalctl -u openclaw-innovation-cron.service -n 20
```

Cron manual:

```cron
0 8 * * 1 cd /opt/openclaw && /usr/bin/node scripts/innovation-cron.mjs >> /var/log/openclaw-innovation-cron.log 2>&1
```

Ver também: `docs/INOVACAO-FASE-3.md`, `docs/CRON-EXEMPLOS.md`, `docs/ESTRATEGIA-CONSCIENCIA-AUTONOMA.md`
