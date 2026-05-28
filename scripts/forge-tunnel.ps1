# Túnel SSH: Digital Forge WS (8787) na EC2 -> localhost
param([int]$Port = 8787)

$ErrorActionPreference = "Stop"

function Load-DotEnv {
    $envPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
    if (-not (Test-Path $envPath)) { return }
    Get-Content $envPath | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        if (-not [Environment]::GetEnvironmentVariable($key)) {
            [Environment]::SetEnvironmentVariable($key, $line.Substring($eq + 1).Trim())
        }
    }
}
Load-DotEnv

$hostSpec = $env:OPENCLAW_EC2_HOST
if (-not $hostSpec -and $env:AWS_EC2_HOST) { $hostSpec = $env:AWS_EC2_HOST }
if (-not $hostSpec -and $env:OPENCLAW_EC2_IP) {
    $user = if ($env:OPENCLAW_EC2_USER) { $env:OPENCLAW_EC2_USER } else { "ubuntu" }
    $hostSpec = "$user@$($env:OPENCLAW_EC2_IP)"
}

$key = $env:OPENCLAW_SSH_KEY
if (-not $key -and $env:AWS_EC2_KEY_PATH) { $key = $env:AWS_EC2_KEY_PATH }

Write-Host "=== Túnel Digital Forge :$Port ===" -ForegroundColor Cyan
Write-Host "  Painel: OPENCLAW_GATEWAY_BASE_URL/forge"
Write-Host "  WS no painel: ws://127.0.0.1:$Port"
Write-Host ""

$sshArgs = @("-N", "-L", "${Port}:127.0.0.1:${Port}")
if ($key -and (Test-Path $key)) { $sshArgs = @("-i", $key) + $sshArgs }
$sshArgs += $hostSpec
& ssh @sshArgs
