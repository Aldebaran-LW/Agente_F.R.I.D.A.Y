@echo off
setlocal
docker exec openclaw-dev-agents claude %*
exit /b %ERRORLEVEL%
