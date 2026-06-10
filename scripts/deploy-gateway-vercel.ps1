# Deploy do gateway OpenClaw (landing + /office + /forge) na Vercel
# Auth: VERCEL_API_TOKEN no .env da raiz, ou `vercel login`
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$gateway = Join-Path $root "gateway"
$envFile = Join-Path $root ".env"
$teamId = $null
$teamSlug = "lucas-willians-projects-506f0514"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*VERCEL_(API_)?TOKEN\s*=\s*(.+)\s*$' -and $_ -notmatch '^\s*#') {
            $env:VERCEL_TOKEN = $Matches[2].Trim().Trim('"').Trim("'")
        }
        if ($_ -match '^\s*VERCEL_TEAM_ID\s*=\s*(.+)\s*$' -and $_ -notmatch '^\s*#') {
            $teamId = $Matches[1].Trim().Trim('"').Trim("'")
        }
        if ($_ -match '^\s*VERCEL_ORG_SLUG\s*=\s*(.+)\s*$' -and $_ -notmatch '^\s*#') {
            $teamSlug = $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
}

$vercelArgs = @("deploy", "--prod", "--yes", "--force")
if ($env:VERCEL_TOKEN) { $vercelArgs += @("--token", $env:VERCEL_TOKEN) }
$scope = if ($teamId -and $teamId.StartsWith("team_")) { $teamId } else { $teamSlug }
if ($scope) { $vercelArgs += @("--scope", $scope) }

if (-not (Test-Path (Join-Path $gateway ".vercel\project.json"))) {
    Write-Host "Falta gateway\.vercel\project.json (projeto agente-openclaw)" -ForegroundColor Red
    exit 1
}

Set-Location $gateway
Write-Host "Deploy agente-openclaw (scope: $scope)..." -ForegroundColor Cyan
& npx vercel @vercelArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host ""
Write-Host "Testar:" -ForegroundColor Green
Write-Host "  https://openclaw.lwdigitalforge.com/"
Write-Host "  https://f.r.i.d.a.y.lwdigitalforge.com/"
Write-Host "  https://openclaw.lwdigitalforge.com/api/health"
