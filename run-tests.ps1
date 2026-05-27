$root = $PSScriptRoot
$envFile = Join-Path $root ".env"
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
if ($vars.VERCEL_API_TOKEN) {
  Write-Host "`n=== VERCEL ==="
  Set-Location (Join-Path $root "scripts")
  if (-not (Test-Path node_modules)) { npm install --silent 2>$null }
  node vercel-status.js
  Set-Location $root
}
if ($vars.MONGODB_URI) {
  Write-Host "`n=== MONGODB ==="
  Set-Location (Join-Path $root "scripts")
  node macofel-count-pending.js
  Set-Location $root
}
if (Get-Command openclaw -ErrorAction SilentlyContinue) {
  Write-Host "`n=== OPENCLAW === instalado"
  openclaw --version 2>&1
} else {
  Write-Host "`n=== OPENCLAW === nao instalado"
}
& (Join-Path $root "sync-workspaces.ps1")