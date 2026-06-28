@echo off
setlocal
docker exec openclaw-dev-agents bash -lc "kilo %* 2>/dev/null || kilocode %*"
exit /b %ERRORLEVEL%
