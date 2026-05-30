#!/usr/bin/env bash
# Forge (:8787) + Orchestrate (:8790) + ClawMetry (:8900) na mesma EC2
set -euo pipefail
REPO="${OPENCLAW_REPO:-$HOME/Agente_OpenClaw}"
cd "$REPO"
bash scripts/setup-forge-ec2.sh
bash scripts/setup-orchestrate-ec2.sh
bash scripts/setup-clawmetry-ec2.sh
echo ""
echo "=== Servicos configurados ==="
echo "  Forge WS:        :${OPENCLAW_FORGE_WS_PORT:-8787}  (tunel SSH recomendado)"
echo "  Orchestrate:     :${OPENCLAW_ORCHESTRATE_PORT:-8790}  (nginx HTTPS para Vercel)"
echo "  ClawMetry:       :${OPENCLAW_CLAWMETRY_PORT:-8900}  (tunel SSH; bind local)"
echo "  Doc: docs/EC2-ORCHESTRATE-WEBHOOK.md · docs/DASHBOARDS-VISUAIS.md"
