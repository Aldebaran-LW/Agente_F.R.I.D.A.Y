#!/usr/bin/env bash
set -euo pipefail
cd /opt/openclaw
touch .env
while IFS= read -r line || [ -n "$line" ]; do
  [ -z "$line" ] && continue
  key="${line%%=*}"
  sudo sed -i "/^${key}=/d" .env 2>/dev/null || true
  echo "$line" | sudo tee -a .env >/dev/null
done < /tmp/openclaw-sync.env
rm -f /tmp/openclaw-sync.env
echo OK env merged
