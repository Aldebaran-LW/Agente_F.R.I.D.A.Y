#!/usr/bin/env bash
# OpenClaw - Cloudflare Tunnel Setup for EC2
# Uso:
#   Quick tunnel (teste):     bash setup-tunnel.sh quick
#   Named tunnel (producao):  bash setup-tunnel.sh named <TUNNEL_TOKEN>

set -euo pipefail

TUNNEL_NAME="openclaw-ec2"
TUNNEL_DOMAIN="ec2.openclaw.lwdigitalforge.com"

echo "=== OpenClaw Cloudflare Tunnel Setup ==="

# 1. Install cloudflared
install_cloudflared() {
  if ! command -v cloudflared &> /dev/null; then
    echo "Installing cloudflared..."
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    sudo dpkg -i /tmp/cloudflared.deb 2>/dev/null || sudo apt-get install -f -y
    rm -f /tmp/cloudflared.deb
  fi
  cloudflared --version
}

# 2. Quick tunnel (no auth, for testing)
setup_quick_tunnel() {
  install_cloudflared
  echo "Starting quick tunnel (trycloudflare.com)..."
  echo "This URL will change each restart. For production, use a named tunnel."

  # Kill existing
  sudo pkill -f "cloudflared tunnel" 2>/dev/null || true

  # Start in background
  nohup cloudflared tunnel --url http://localhost:8080 > /tmp/cloudflared.log 2>&1 &
  sleep 5

  # Extract URL from log
  TUNNEL_URL=$(grep -oP 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1)
  echo ""
  echo "=== Quick Tunnel Started ==="
  echo "URL: ${TUNNEL_URL}"
  echo "Log: /tmp/cloudflared.log"
  echo ""
  echo "Configure EC2_HOST no Cloudflare Worker com esta URL"
}

# 3. Named tunnel (requires token from Cloudflare dashboard)
setup_named_tunnel() {
  local TOKEN="$1"
  install_cloudflared

  echo "Setting up named tunnel: ${TUNNEL_NAME}..."

  # Create config
  mkdir -p ~/.cloudflared
  cat > ~/.cloudflared/config.yml << EOF
tunnel: ${TUNNEL_NAME}
credentials-file: /home/ubuntu/.cloudflared/${TUNNEL_NAME}.json
ingress:
  - hostname: ${TUNNEL_DOMAIN}
    service: http://localhost:8080
    originRequest:
      noTLSVerify: true
  - service: http_status:404
EOF

  # Run with token
  echo "Starting named tunnel..."
  nohup cloudflared tunnel run --token "${TOKEN}" ${TUNNEL_NAME} > /tmp/cloudflared.log 2>&1 &
  sleep 5

  echo ""
  echo "=== Named Tunnel Started ==="
  echo "URL: https://${TUNNEL_DOMAIN}"
  echo "Make sure DNS record exists in Cloudflare dashboard"
  echo ""
  echo "Configure EC2_HOST no Cloudflare Worker: https://${TUNNEL_DOMAIN}"
}

# Main
case "${1:-quick}" in
  quick)
    setup_quick_tunnel
    ;;
  named)
    if [ -z "${2:-}" ]; then
      echo "Usage: bash setup-tunnel.sh named <TUNNEL_TOKEN>"
      echo ""
      echo "To get a token:"
      echo "1. Go to Cloudflare Dashboard > Zero Trust > Tunnels"
      echo "2. Create a new tunnel"
      echo "3. Copy the tunnel token"
      echo "4. Run: bash setup-tunnel.sh named <TOKEN>"
      exit 1
    fi
    setup_named_tunnel "$2"
    ;;
  *)
    echo "Usage: bash setup-tunnel.sh [quick|named <TOKEN>]"
    exit 1
    ;;
esac
