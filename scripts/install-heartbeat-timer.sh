#!/usr/bin/env bash
set -euo pipefail
WORKSPACE="${OPENCLAW_WORKSPACE:-/opt/openclaw}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(id -u)" -ne 0 ]]; then echo "Execute como root"; exit 1; fi
if ! command -v python3 >/dev/null 2>&1; then apt-get update -qq && apt-get install -y -qq python3; fi
chmod +x "${WORKSPACE}/scripts/heartbeat.py" 2>/dev/null || true
cp "${SCRIPT_DIR}/systemd/openclaw-heartbeat.service" /etc/systemd/system/
cp "${SCRIPT_DIR}/systemd/openclaw-heartbeat.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now openclaw-heartbeat.timer
systemctl status openclaw-heartbeat.timer --no-pager || true
echo "Teste: OPENCLAW_ENV=${WORKSPACE}/.env python3 ${WORKSPACE}/scripts/heartbeat.py --dry-run"