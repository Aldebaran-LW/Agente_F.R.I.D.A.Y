#!/usr/bin/env bash
# EC2: libertar disco (heartbeat alerta se livre <10%)
# Uso: sudo bash scripts/ec2-disk-cleanup.sh
# Do PC: .\scripts\ec2-sync-from-pc.ps1 (inclui cleanup quando repo actualizado)
set -euo pipefail

echo "==> Disco antes"
df -h /

echo "==> Top 10 pastas (/)"
du -xh / 2>/dev/null | sort -rh | head -10 || true

echo "==> journal (100M max, >3 dias)"
journalctl --vacuum-size=100M 2>/dev/null || true
journalctl --vacuum-time=3d 2>/dev/null || true

echo "==> apt cache"
apt-get clean -qq 2>/dev/null || true
apt-get autoremove -y -qq 2>/dev/null || true
rm -rf /var/cache/apt/archives/* 2>/dev/null || true

echo "==> /tmp e cache npm"
find /tmp -type f -atime +2 -delete 2>/dev/null || true
if id ubuntu &>/dev/null; then
  sudo -u ubuntu npm cache clean --force 2>/dev/null || true
fi

echo "==> logs OpenClaw"
for d in /opt/openclaw/logs /root/.openclaw/logs; do
  if [[ -d "$d" ]]; then
    find "$d" -name "*.log" -mtime +7 -delete 2>/dev/null || true
  fi
done
for f in /var/log/openclaw*.log; do
  [[ -f "$f" ]] && truncate -s 0 "$f" 2>/dev/null || true
done

echo "==> sessoes OpenClaw (>3 dias)"
OC="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
BASE="$(dirname "$OC")/agents"
if [[ -d "$BASE" ]]; then
  find "$BASE" -path '*/sessions/*.jsonl' -mtime +3 -delete 2>/dev/null || true
fi

echo "==> Docker (se instalado)"
if command -v docker &>/dev/null; then
  docker system prune -af --volumes 2>/dev/null || true
fi

echo "==> Ollama (~700MB — nao usado; inferencia via HF/gateway)"
if command -v ollama &>/dev/null; then
  for m in $(ollama list 2>/dev/null | awk 'NR>1 {print $1}'); do
    ollama rm "$m" 2>/dev/null || true
  done
  systemctl stop ollama 2>/dev/null || true
  systemctl disable ollama 2>/dev/null || true
fi
rm -rf /usr/share/ollama/.ollama/models/blobs/* 2>/dev/null || true

echo "==> clones locais pesados (opcional)"
rm -rf /home/ubuntu/macofel/node_modules 2>/dev/null || true
find /home/ubuntu -maxdepth 3 -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true

echo "==> Disco depois"
df -h /

USED="$(df / | awk 'NR==2 {print $5}' | tr -d '%')"
AVAIL="$(df -h / | awk 'NR==2 {print $4}')"
echo "Uso: ${USED}% | Livre: ${AVAIL}"

if [[ "$USED" -gt 90 ]]; then
  echo ""
  echo "AVISO: disco ainda >90% — aumente volume EBS (8→16 GB) no console AWS:"
  echo "  EC2 → Volumes → Modify → growpart + resize2fs"
  echo "  Ver docs/EC2-DISCO.md"
  exit 1
fi

echo "OK cleanup — heartbeat deve parar alerta CRITICO se livre >=10%"
