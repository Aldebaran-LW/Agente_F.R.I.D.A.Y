#!/usr/bin/env bash
# Instala/atualiza TODOS os systemd units do OpenClaw na EC2
# Uso: bash scripts/install-all-services.sh [--user]
set -euo pipefail

MODE="${1:---system}"
REPO="${OPENCLAW_REPO:-/opt/openclaw}"
SRC="$REPO/scripts/systemd"

if [[ "$MODE" == "--user" ]]; then
  DEST="${HOME}/.config/systemd/user"
  mkdir -p "$DEST"
  CTRL="systemctl --user"
  loginctl enable-linger "$USER" 2>/dev/null || true
else
  DEST="/etc/systemd/system"
  CTRL="systemctl"
fi

echo "=== Instalando systemd units do OpenClaw ($MODE) ==="
echo "  Origem: $SRC"
echo "  Destino: $DEST"
echo ""

# Lista de services + timers
UNITS=(
  openclaw-heartbeat.service
  openclaw-heartbeat.timer
  openclaw-innovation-cron.service
  openclaw-innovation-cron.timer
  openclaw-telegram-jarvis-bridge.service
)

# Hooks (opcionais — dependem de ~/.openclaw/.env)
HOOK_UNITS=(
  openclaw-orchestrate.service
  openclaw-queue-worker.service
  openclaw-forge.service
  openclaw-clawmetry.service
)

installed=0
for unit in "${UNITS[@]}" "${HOOK_UNITS[@]}"; do
  src="$SRC/$unit"
  if [[ ! -f "$src" ]]; then
    echo "  AVISO: $unit nao encontrado em $SRC — pulando"
    continue
  fi
  cp "$src" "$DEST/$unit"
  echo "  OK: $unit"
  ((installed++))
done

echo ""
echo "=== $installed units copiados para $DEST ==="
echo ""

$CTRL daemon-reload

# Ativar timers
echo "=== Ativando timers ==="
$CTRL enable --now openclaw-heartbeat.timer 2>/dev/null && echo "  heartbeat.timer OK" || echo "  heartbeat.timer pulado"
$CTRL enable --now openclaw-innovation-cron.timer 2>/dev/null && echo "  innovation-cron.timer OK" || echo "  innovation-cron.timer pulado"

# Ativar services essenciais
echo ""
echo "=== Ativando services ==="
for s in openclaw-telegram-jarvis-bridge openclaw-orchestrate openclaw-queue-worker; do
  if $CTRL enable --now "$s.service" 2>/dev/null; then
    echo "  $s OK"
  else
    echo "  $s pulado (pode precisar de config)"
  fi
done

echo ""
echo "=== Status ==="
$CTRL status openclaw-heartbeat.timer --no-pager 2>/dev/null || true
$CTRL status openclaw-innovation-cron.timer --no-pager 2>/dev/null || true

echo ""
echo "Concluido. Verificar com:"
echo "  $CTRL list-timers --all"
echo "  $CTRL status openclaw-orchestrate"
echo "  journalctl -u openclaw-orchestrate -f"
echo ""
echo "Para systemd user: bash $0 --user"
