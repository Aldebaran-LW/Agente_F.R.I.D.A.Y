# Túnel SSH: EC2 OpenClaw WebSocket -> localhost (Claw3D / openclaw-office)
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
if (-not $hostSpec -and $env:AWS_EC2_HOST) {
    $hostSpec = $env:AWS_EC2_HOST
}
if (-not $hostSpec) {
    $ip = $env:OPENCLAW_EC2_IP
    $user = if ($env:OPENCLAW_EC2_USER) { $env:OPENCLAW_EC2_USER } else { $env:AWS_EC2_USER }
    if (-not $user) { $user = "ec2-user" }
    if ($ip) { $hostSpec = "${user}@${ip}" }
}
if (-not $hostSpec -and $env:AWS_EC2_HOST -match "@") {
    $hostSpec = $env:AWS_EC2_HOST
}

if (-not $hostSpec) {
    Write-Host "Defina OPENCLAW_EC2_HOST ou OPENCLAW_EC2_IP no .env" -ForegroundColor Red
    Write-Host "Exemplo: OPENCLAW_EC2_HOST=ec2-user@18.191.36.145"
    exit 1
}

$localPort = if ($env:OPENCLAW_WS_LOCAL_PORT) { $env:OPENCLAW_WS_LOCAL_PORT } else { "18789" }
$remotePort = if ($env:OPENCLAW_WS_REMOTE_PORT) { $env:OPENCLAW_WS_REMOTE_PORT } else { "18789" }
$key = $env:OPENCLAW_SSH_KEY
if (-not $key -and $env:AWS_EC2_KEY_PATH) { $key = $env:AWS_EC2_KEY_PATH }

Write-Host "=== Túnel Claw3D ===" -ForegroundColor Cyan
Write-Host "  Local:  ws://127.0.0.1:${localPort}"
Write-Host "  Remoto: ${hostSpec}:${remotePort}"
Write-Host ""
Write-Host "Mantém esta janela aberta. No Claw3D Studio, Gateway URL = ws://127.0.0.1:${localPort}"
Write-Host "Doc: docs/VISUALIZACAO-AGENTES.md"
Write-Host ""

$sshArgs = @(
    "-N",
    "-L", "${localPort}:127.0.0.1:${remotePort}",
    $hostSpec
)

if ($key -and (Test-Path $key)) {
    $sshArgs = @("-i", $key) + $sshArgs
}

& ssh @sshArgs
