# Sync config.yaml -> daemon OpenClaw

Cada cerebro em `agents/<id>/config.yaml` define modelo LLM (OpenRouter free), skills e secrets.

## Comandos

```powershell
node scripts/validate-agent-config.mjs
node scripts/sync-agent-config-to-openclaw.mjs --dry-run
node scripts/sync-agent-config-to-openclaw.mjs --apply      # PC com ~/.openclaw/openclaw.json
node scripts/sync-agent-config-to-openclaw.mjs --emit-sh  # gera bash para EC2
```

## EC2

```bash
cd /opt/openclaw && git pull
sudo bash scripts/ec2-apply-agent-config.sh
# ou: set -a; source .env; set +a; node scripts/sync-agent-config-to-openclaw.mjs --emit-sh | sudo bash
sudo systemctl restart openclaw-gateway
```

## Novo agente

```powershell
node scripts/scaffold-agent.mjs --id research --name "Research Bot" --model google/gemma-4-26b-a4b-it:free
node scripts/validate-agent-config.mjs
```

## Aprendizagem no HF Dataset

```powershell
node scripts/hf-ingest-learning.mjs --agent macofel --text "Modelo X no HF util para catalogo"
```

Grava em `learnings/<agent>/` no Dataset `Aldebaran-LW/openclaw-backup`.

Ver `docs/HUGGINGFACE-SPACES.md`.