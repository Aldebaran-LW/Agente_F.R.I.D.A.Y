#!/usr/bin/env bash
# EC2: libertar disco (heartbeat alerta <10% livre)
# Uso: sudo bash scripts/ec2-disk-cleanup.sh
set -euo pipefail

echo "==> Disco antes"
df -h /

echo "==> apt cache"
apt-get clean -qq 2>/dev/null || true
apt-get autoremove -y -qq 2>/dev/null || true

echo "==> journal (50M max)"
journalctl --vacuum-size=50M 2>/dev/null || true

echo "==> logs OpenClaw antigos"
for f in /var/log/openclaw*.log; do
  [[ -f "$f" ]] && truncate -s 0 "$f" 2>/dev/null || true
done

echo "==> sessoes OpenClaw (mantem ultimas 2 por agente)"
OC="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
BASE="$(dirname "$OC")/agents"
if [[ -d "$BASE" ]]; then
  find "$BASE" -path '*/sessions/*.jsonl' -mtime +3 -delete 2>/dev/null || true
fi

echo "==> npm cache (ubuntu)"
if id ubuntu &>/dev/null; then
  sudo -u ubuntu npm cache clean --force 2>/dev/null || true
fi

echo "==> Docker (se instalado)"
if command -v docker &>/dev/null; then
  docker system prune -af --volumes 2>/dev/null || true
fi

echo "==> Ollama models (libera ~700MB)"
if command -v ollama &>/dev/null; then
  ollama list 2>/dev/null || true
  for m in $(ollama list 2>/dev/null | awk 'NR>1 {print $1}'); do
    ollama rm "$m" 2>/dev/null || true
  done
  systemctl stop ollama 2>/dev/null || true
  systemctl disable ollama 2>/dev/null || true
fi

rm -rf /usr/share/ollama/.ollama/models/blobs/* 2>/dev/null || true
rm -rf /home/ubuntu/macofel/.git/objects/pack/* 2>/dev/null || true
rm -rf /home/ubuntu/macofel/node_modules 2>/dev/null || true

echo "==> Ollama models (opcional — libera GB)"

echo "==> Disco depois"
df -h /

FREE="$(df / | awk 'NR==2 {print $5}' | tr -d '%')"
if [[ "$FREE" -gt 90 ]]; then
  echo "AVISO: disco ainda >90% usado — considere aumentar volume EBS ou mover logs para S3"
  exit 1
fi
echo "OK cleanup (uso ${FREE}%)"
