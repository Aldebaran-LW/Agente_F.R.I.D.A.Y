#!/usr/bin/env bash
# Limpa sessoes OpenClaw com contexto estourado (Telegram preso)
set -euo pipefail
BASE="${OPENCLAW_STATE:-/root/.openclaw}"
for agent in orchestrator macofel; do
  dir="$BASE/agents/$agent/sessions"
  if [[ -d "$dir" ]]; then
    count=$(find "$dir" -name '*.jsonl' 2>/dev/null | wc -l)
    find "$dir" -name '*.jsonl' -delete 2>/dev/null || true
    echo "OK limpo $count sessao(oes) em $dir"
  fi
done
systemctl restart openclaw-gateway
sleep 3
systemctl is-active openclaw-gateway
echo "Telegram: envie /new depois ajuda"
