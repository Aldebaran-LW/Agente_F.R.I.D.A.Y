#!/usr/bin/env bash
set -euo pipefail
WORKSPACE="${OPENCLAW_WORKSPACE:-/opt/openclaw}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(id -u)" -ne 0 ]]; then echo "Execute como root"; exit 1; fi
if ! command -v node >/dev/null 2>&1; then echo "node ausente"; exit 1; fi
chmod +x "${WORKSPACE}/scripts/innovation-cron.mjs" 2>/dev/null || true
cp "${SCRIPT_DIR}/systemd/openclaw-innovation-cron.service" /etc/systemd/system/
cp "${SCRIPT_DIR}/systemd/openclaw-innovation-cron.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now openclaw-innovation-cron.timer
systemctl status openclaw-innovation-cron.timer --no-pager || true
echo "Teste: cd ${WORKSPACE} && node scripts/innovation-cron.mjs --dry-run"
