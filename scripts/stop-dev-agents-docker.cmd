@echo off
docker stop openclaw-dev-agents 2>nul
docker rm openclaw-dev-agents 2>nul
cd /d "%~dp0..\docker\dev-agents"
docker compose down --remove-orphans 2>nul
echo OK dev-agents parado
