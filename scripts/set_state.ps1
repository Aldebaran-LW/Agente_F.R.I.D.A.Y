# Wrapper Windows para scripts/set_state.py
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$py = if (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" } else { "python" }
& $py (Join-Path $PSScriptRoot "set_state.py") @args
exit $LASTEXITCODE
