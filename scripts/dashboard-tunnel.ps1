# Túnel SSH: dashboard na EC2 -> localhost
param(
    [int]$Port = 3000,
    [int]$RemotePort = 0
)

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

if ($RemotePort -eq 0) { $RemotePort = $Port }

$hostSpec = $env:OPENCLAW_EC2_HOST
if (-not $hostSpec -and $env:AWS_EC2_HOST) { $hostSpec = $env:AWS_EC2_HOST }
if (-not $hostSpec -and $env:OPENCLAW_EC2_IP) {
    $user = if ($env:OPENCLAW_EC2_USER) { $env:OPENCLAW_EC2_USER } else { "ubuntu" }
    $hostSpec = "$user@$($env:OPENCLAW_EC2_IP)"
}

if (-not $hostSpec) {
    Write-Host "Defina OPENCLAW_EC2_HOST ou OPENCLAW_EC2_IP no .env" -ForegroundColor Red
    exit 1
}

$key = $env:OPENCLAW_SSH_KEY
if (-not $key -and $env:AWS_EC2_KEY_PATH) { $key = $env:AWS_EC2_KEY_PATH }

$urls = @{
    3000 = "AgentMonitor"
    3200 = "AgentMonitor (plugin)"
    19000 = "Star Office UI"
}

$label = $urls[$Port]
if (-not $label) { $label = "Dashboard" }

Write-Host "=== Túnel $label ===" -ForegroundColor Cyan
Write-Host "  Local:  http://127.0.0.1:${Port}"
Write-Host "  Remoto: ${hostSpec}:${RemotePort}"
Write-Host ""

$sshArgs = @("-N", "-L", "${Port}:127.0.0.1:${RemotePort}", $hostSpec)
if ($key -and (Test-Path $key)) { $sshArgs = @("-i", $key) + $sshArgs }

& ssh @sshArgs
