#!/usr/bin/env bash
# EC2: aplicar agents/*/config.yaml ao daemon OpenClaw
set -euo pipefail
OPENCLAW_ROOT="${OPENCLAW_ROOT:-/opt/openclaw}"
cd "$OPENCLAW_ROOT"
set -a
source .env 2>/dev/null || true
set +a
export PATH="/usr/local/bin:$PATH"
node scripts/sync-agent-config-to-openclaw.mjs --emit-sh | bash
echo "OK modelos por cerebro aplicados"