@echo off
setlocal
cd /d "%~dp0..\docker\dev-agents"
docker compose build
docker ps --filter name=^/openclaw-dev-agents$ --format "{{.Names}}" | findstr /x openclaw-dev-agents >nul || docker compose run -d --name openclaw-dev-agents dev-agents sleep infinity
docker exec -it openclaw-dev-agents bash
