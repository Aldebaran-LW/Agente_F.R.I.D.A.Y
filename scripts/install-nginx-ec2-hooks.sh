#!/usr/bin/env bash
# Nginx reverse proxy HTTPS -> Forge (8787) e Orchestrate (8790)
# Requer: certbot ou certificado existente. Executar como root na EC2.
set -euo pipefail

DOMAIN="${EC2_HOOKS_DOMAIN:-ec2-hooks.lwdigitalforge.com}"
EMAIL="${CERTBOT_EMAIL:-}"
CONF_DST="/etc/nginx/sites-available/openclaw-ec2-hooks.conf"
REPO="${OPENCLAW_REPO:-/opt/openclaw}"
SRC="${REPO}/scripts/nginx/openclaw-ec2-hooks.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Execute como root: sudo bash $0"
  exit 1
fi

echo "=== Nginx OpenClaw hooks (${DOMAIN}) ==="

apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

if [[ ! -f "$SRC" ]]; then
  echo "ERRO: template em falta: $SRC"
  echo "  Copie o repo para ${REPO} ou export OPENCLAW_REPO"
  exit 1
fi

sed "s/__EC2_HOOKS_DOMAIN__/${DOMAIN}/g" "$SRC" >"$CONF_DST"
ln -sf "$CONF_DST" /etc/nginx/sites-enabled/openclaw-ec2-hooks.conf
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t
systemctl reload nginx

if [[ -n "$EMAIL" ]]; then
  echo "==> certbot (HTTPS)"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || {
    echo "AVISO: certbot falhou — confirme DNS A para $DOMAIN e repita:"
    echo "  certbot --nginx -d $DOMAIN"
  }
else
  echo "AVISO: defina CERTBOT_EMAIL para obter HTTPS automaticamente"
fi

systemctl reload nginx

echo ""
echo "URLs (apos DNS A -> IP da EC2):"
echo "  https://${DOMAIN}/orchestrate/health"
echo "  https://${DOMAIN}/orchestrate/task   <- JARVIS_EC2_WEBHOOK_URL na Vercel"
echo ""
echo "Vercel gateway .env:"
echo "  JARVIS_EC2_WEBHOOK_URL=https://${DOMAIN}/orchestrate/task"
echo ""
echo "Firewall:"
echo "  ufw allow 80/tcp && ufw allow 443/tcp"
