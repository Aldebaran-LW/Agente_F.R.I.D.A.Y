#!/usr/bin/env bash
# OpenClaw - Script de deploy EC2 (Khoj + MeiliSearch + Aprise)
# Rodar no EC2: bash setup-ec2.sh

set -euo pipefail

EC2_DIR="/opt/openclaw"
DOCKER_COMPOSE_URL="https://raw.githubusercontent.com/Aldebaran-LW/Agente_F.R.I.D.A.Y/main/docker/docker-compose.yml"
NGINX_CONF_URL="https://raw.githubusercontent.com/Aldebaran-LW/Agente_F.R.I.D.A.Y/main/docker/nginx.conf"

echo "=== OpenClaw EC2 Setup ==="

# 1. Install Docker if needed
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
fi

# 2. Create directory
sudo mkdir -p $EC2_DIR
cd $EC2_DIR

# 3. Download configs
echo "Downloading configs..."
curl -fsSL $DOCKER_COMPOSE_URL -o docker-compose.yml
curl -fsSL $NGINX_CONF_URL -o nginx.conf

# 4. Create .env
if [ ! -f .env ]; then
  echo "Creating .env..."
  cat > .env << 'ENVEOF'
MEILI_MASTER_KEY=openclaw-meili-key-change-me
KHOJ_ADMIN_PASSWORD=openclaw-admin-change-me
KHOJ_DJANGO_SECRET_KEY=openclaw-khoj-secret-change-me
KHOJ_OPENAI_API_KEY=
KHOJ_OPENAI_API_BASE_URL=https://api.openai.com/v1
TELEGRAM_BOT_TOKEN=
KHOJ_DOMAIN=http://localhost:4000
ENVEOF
fi

# 5. Pull images
echo "Pulling Docker images..."
docker compose pull

# 6. Start services
echo "Starting services..."
docker compose up -d

# 7. Wait for health
echo "Waiting for services to start..."
sleep 10

echo "=== Status ==="
docker compose ps

echo ""
echo "=== Setup complete ==="
echo "MeiliSearch: http://localhost:7700"
echo "Khoj:        http://localhost:4000"
echo "Apprise:     http://localhost:8000"
echo "Proxy:       http://localhost:8080"
echo ""
echo "Security: abrir porta 8080 no security group da EC2"
echo "Cloudflare: configurar EC2_HOST no Integration Worker"
