$root = $PSScriptRoot
Push-Location (Join-Path $root "scripts")
node check-basico.js
exit $LASTEXITCODE