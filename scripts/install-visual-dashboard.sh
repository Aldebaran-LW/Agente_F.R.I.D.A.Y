#!/usr/bin/env bash
# Instala dashboards visuais em ~/.openclaw/dashboards/
# Uso: ./scripts/install-visual-dashboard.sh [agent-monitor|star-office|monitor3d|all]
set -euo pipefail

DASH="${1:-agent-monitor}"
WORKDIR="${OPENCLAW_DASHBOARDS_DIR:-$HOME/.openclaw/dashboards}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$WORKDIR"
cd "$WORKDIR"

install_agent_monitor() {
  local dir="$WORKDIR/agent-monitor"
  if [[ -d "$dir/.git" ]]; then
    echo "[agent-monitor] já existe — git pull"
    git -C "$dir" pull --ff-only || true
  else
    git clone --depth 1 https://github.com/ruiqili2/agent-monitor.git "$dir"
  fi
  cd "$dir"
  if [[ -f install.sh ]]; then chmod +x install.sh && ./install.sh
  else npm install
  fi
  cat > "$dir/openclaw-start.sh" <<'EOF'
#!/usr/bin/env bash
cd "$(dirname "$0")"
if [[ -f startup.sh ]]; then exec ./startup.sh; fi
npm run dev
EOF
  chmod +x "$dir/openclaw-start.sh" 2>/dev/null || true
  echo "[agent-monitor] OK → porta 3000 (npm run dev)"
  echo "  Plugin alternativo: openclaw plugins install @openclaw/agent-monitor"
}

install_star_office() {
  local dir="$WORKDIR/Star-Office-UI"
  if [[ -d "$dir/.git" ]]; then
    echo "[star-office] já existe — git pull"
    git -C "$dir" pull --ff-only || true
  else
    git clone --depth 1 https://github.com/ringhyacinth/Star-Office-UI.git "$dir"
  fi
  cd "$dir"
  python3 -m pip install -r backend/requirements.txt --user 2>/dev/null \
    || python3 -m pip install -r backend/requirements.txt
  if [[ ! -f state.json && -f state.sample.json ]]; then
    cp state.sample.json state.json
  fi
  echo "[star-office] OK → cd backend && python3 app.py → http://127.0.0.1:19000"
  echo "  set_state: export OPENCLAW_STAR_OFFICE_DIR=$dir"
}

install_monitor3d() {
  local dir="$WORKDIR/openclaw-monitor"
  if [[ -d "$dir/.git" ]]; then
    git -C "$dir" pull --ff-only || true
  else
    git clone --depth 1 https://github.com/ccperdst-lab/openclaw-monitor.git "$dir"
  fi
  cd "$dir"
  if [[ -f package.json ]]; then npm install; fi
  echo "[monitor3d] OK → ver README do repo (npm run dev)"
}

link_set_state() {
  mkdir -p "$HOME/.openclaw/workspace"
  if [[ -f "$REPO_ROOT/scripts/set_state.py" ]]; then
    ln -sf "$REPO_ROOT/scripts/set_state.py" "$HOME/.openclaw/workspace/set_state.py" 2>/dev/null || \
      cp "$REPO_ROOT/scripts/set_state.py" "$HOME/.openclaw/workspace/set_state.py"
    echo "[set_state] ligado em ~/.openclaw/workspace/set_state.py"
  fi
}

case "$DASH" in
  agent-monitor|monitor|am) install_agent_monitor ;;
  star-office|star|office) install_star_office ;;
  monitor3d|3d) install_monitor3d ;;
  all)
    install_agent_monitor
    install_star_office
    install_monitor3d
    ;;
  *)
    echo "Uso: $0 [agent-monitor|star-office|monitor3d|all]"
    exit 1
    ;;
esac

link_set_state

echo ""
echo "=== Próximos passos ==="
echo "1. Colar regras em ~/.openclaw/workspace/SOUL.md (ver agents/_shared/DASHBOARD-SYNC.md)"
echo "2. Iniciar dashboard e usar túnel SSH do PC: scripts/dashboard-tunnel.ps1"
echo "3. Doc: docs/DASHBOARDS-VISUAIS.md"
