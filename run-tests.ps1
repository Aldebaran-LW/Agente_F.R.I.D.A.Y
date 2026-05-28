$root = $PSScriptRoot
$localRoot = "C:\Users\LUCAS_W\Documents\GitHub\Agente_OpenClaw"
$envFile = Join-Path $root ".env"

function Get-ScriptsDir {
  $driveScripts = Join-Path $root "scripts"
  $localScripts = Join-Path $localRoot "scripts"
  $pkg = Join-Path $driveScripts "node_modules\mongodb\package.json"
  if ((Test-Path $pkg) -and ((Get-Item $pkg -ErrorAction SilentlyContinue).Length -gt 50)) {
    return $driveScripts
  }
  if (Test-Path $localScripts) {
    if (Test-Path $envFile) {
      $localEnv = Join-Path $localRoot ".env"
      if (-not (Test-Path $localEnv) -or ((Get-Item $envFile).LastWriteTimeUtc -gt (Get-Item $localEnv).LastWriteTimeUtc)) {
        Copy-Item $envFile $localEnv -Force
      }
    }
    return $localScripts
  }
  return $driveScripts
}
$vars = @{}
if (Test-Path $envFile) {
  Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    $t = $_.Trim()
    if ($t -and -not $t.StartsWith("#") -and $t.Contains("=")) {
      $i = $t.IndexOf("=")
      $vars[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim().Trim('"')
    }
  }
}
Write-Host "=== CHAVES ==="
@("TELEGRAM_BOT_TOKEN","VERCEL_API_TOKEN","GITHUB_TOKEN","MONGODB_URI","GOOGLE_API_KEY") | ForEach-Object {
  $ok = [bool]($vars[$_] -and $vars[$_].Length -gt 0)
  Write-Host ("  $_ : " + $(if ($ok) { "OK" } else { "VAZIO" }))
}
if ($vars.TELEGRAM_BOT_TOKEN) {
  Write-Host "`n=== TELEGRAM ==="
  try {
    $r = Invoke-RestMethod -Uri ("https://api.telegram.org/bot" + $vars.TELEGRAM_BOT_TOKEN + "/getMe") -TimeoutSec 20
    Write-Host ("  @" + $r.result.username + " OK")
  } catch { Write-Host "  ERRO" }
}
if ($vars.GITHUB_TOKEN) {
  Write-Host "`n=== GITHUB ==="
  $h = @{ Accept = "application/vnd.github+json"; Authorization = "Bearer " + $vars.GITHUB_TOKEN }
  @("Macofel_2.0","VP-Pecas","vp-precision-studio") | ForEach-Object {
    try {
      Invoke-RestMethod -Uri ("https://api.github.com/repos/Aldebaran-LW/" + $_) -Headers $h -TimeoutSec 20 | Out-Null
      Write-Host ("  $_ OK")
    } catch { Write-Host ("  $_ ERRO") }
  }
}
$scriptsDir = Get-ScriptsDir
if ($scriptsDir -notlike "$root*") {
  Write-Host "`n  (scripts na copia local; node_modules no Drive corrompe pacotes)"
}
if ($vars.VERCEL_API_TOKEN) {
  Write-Host "`n=== VERCEL ==="
  Push-Location $scriptsDir
  if (-not (Test-Path node_modules)) { npm install --silent 2>$null }
  node vercel-status.js
  Pop-Location
}
if ($vars.MONGODB_URI) {
  Write-Host "`n=== MONGODB ==="
  Push-Location $scriptsDir
  node macofel-status.js
  Pop-Location
}
if (Get-Command openclaw -ErrorAction SilentlyContinue) {
  Write-Host "`n=== OPENCLAW === instalado"
  openclaw --version 2>&1
} else {
  Write-Host "`n=== OPENCLAW === nao instalado"
}
& (Join-Path $root "sync-workspaces.ps1")