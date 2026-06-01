# Cron — pipeline de inovação (semanal)

## Script

```bash
node scripts/innovation-cron.mjs
node scripts/innovation-cron.mjs --dry-run
```

Executa: `sophia-research` → `yato-market-search` → `senku-process` → `gideon-predict`.

Log: `data/innovation/cron-last.json`

Se Gideon score ≥ `GIDEON_THRESHOLD` (70) e `recomendacao: hefestos`, regista alerta no log — **não** constrói automaticamente (exige `sim` no Telegram + `hefestos-build --apply --approved`).

## Variáveis (.env)

| Variável | Default |
|----------|---------|
| `INNOVATION_TOPIC_SOPHIA` | `IA devtools agentes openclaw` |
| `INNOVATION_TOPIC_YATO` | `automação SaaS IA mercado` |
| `GIDEON_THRESHOLD` | `70` |
| `HEFESTOS_APPROVED` | `sim` (só para `--apply --approved`) |

## EC2 (segunda-feira 8h)

```cron
0 8 * * 1 cd /opt/openclaw && /usr/bin/node scripts/innovation-cron.mjs >> /var/log/openclaw-innovation-cron.log 2>&1
```

Ver também: `docs/INOVACAO-FASE-3.md`, `docs/CRON-EXEMPLOS.md`
