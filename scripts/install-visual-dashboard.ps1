# Instala dashboards em %USERPROFILE%\.openclaw\dashboards\
param(
    [ValidateSet("agent-monitor", "star-office", "monitor3d", "all")]
    [string]$Dashboard = "agent-monitor"
)

$ErrorActionPreference = "Stop"
$workDir = if ($env:OPENCLAW_DASHBOARDS_DIR) { $env:OPENCLAW_DASHBOARDS_DIR } else { Join-Path $env:USERPROFILE ".openclaw\dashboards" }
$repoRoot = Split-Path $PSScriptRoot -Parent

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

function Install-AgentMonitor {
    $dir = Join-Path $workDir "agent-monitor"
    if (Test-Path (Join-Path $dir ".git")) {
        Write-Host "[agent-monitor] git pull"
        Set-Location $dir; git pull --ff-only 2>$null; Set-Location $workDir
    } else {
        git clone --depth 1 https://github.com/ruiqili2/agent-monitor.git $dir
    }
    Set-Location $dir
    if (Test-Path "install.bat") { cmd /c install.bat } else { npm install }
    Set-Location $workDir
    Write-Host "[agent-monitor] OK → npm run dev → http://localhost:3000"
}

function Install-StarOffice {
    $dir = Join-Path $workDir "Star-Office-UI"
    if (-not (Test-Path (Join-Path $dir ".git"))) {
        git clone --depth 1 https://github.com/ringhyacinth/Star-Office-UI.git $dir
    }
    Set-Location $dir
    python -m pip install -r backend/requirements.txt
    if (-not (Test-Path "state.json") -and (Test-Path "state.sample.json")) {
        Copy-Item state.sample.json state.json
    }
    Set-Location $workDir
    Write-Host "[star-office] OK → cd backend; python app.py → http://127.0.0.1:19000"
}

function Link-SetState {
    $ws = Join-Path $env:USERPROFILE ".openclaw\workspace"
    New-Item -ItemType Directory -Force -Path $ws | Out-Null
    $src = Join-Path $repoRoot "scripts\set_state.py"
    Copy-Item -Force $src (Join-Path $ws "set_state.py")
    Write-Host "[set_state] copiado para $ws\set_state.py"
}

switch ($Dashboard) {
    "agent-monitor" { Install-AgentMonitor }
    "star-office" { Install-StarOffice }
    "all" { Install-AgentMonitor; Install-StarOffice }
    default { Write-Host "monitor3d: usar install-visual-dashboard.sh na EC2"; exit 1 }
}

Link-SetState
Write-Host ""
Write-Host "Doc: docs\DASHBOARDS-VISUAIS.md"
