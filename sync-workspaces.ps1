# Sincroniza LOCAL <-> Google Drive (sem node_modules/.git)
# Canonico para Git: LOCAL. Drive = copia espelhada + backup .env
param(
  [ValidateSet('Both', 'ToDrive', 'ToLocal')]
  [string]$Direction = 'Both'
)

$Local = "C:\Users\LUCAS_W\Documents\GitHub\Agente_OpenClaw"
$Drive = "G:\Meu Drive\Projetos\OpenClaw"
$Exclude = @('node_modules', '.git', '.sync-state.json', 'desktop.ini')

function Sync-Dir($src, $dst) {
  if (-not (Test-Path $src)) { return 0 }
  if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Force -Path $dst | Out-Null }
  $n = 0
  Get-ChildItem $src -Recurse -File -Force | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length).TrimStart('\')
    if ($Exclude | Where-Object { $rel -like "*$_*" }) { return }
    $target = Join-Path $dst $rel
    $dir = Split-Path $target -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $copy = $false
    if (-not (Test-Path $target)) { $copy = $true }
    elseif ($_.LastWriteTimeUtc -gt (Get-Item $target).LastWriteTimeUtc) { $copy = $true }
    if ($copy) {
      Copy-Item $_.FullName $target -Force
      $script:n++
    }
  }
  return $n
}

$stats = @{ ToDrive = 0; ToLocal = 0 }
if ($Direction -in 'Both', 'ToDrive') { $stats.ToDrive = Sync-Dir $Local $Drive }
if ($Direction -in 'Both', 'ToLocal') { $stats.ToLocal = Sync-Dir $Drive $Local }

# .env: copiar o mais recente para o outro lado
foreach ($pair in @(@($Local, $Drive), @($Drive, $Local))) {
  $a, $b = $pair
  $fa = Join-Path $a '.env'
  $fb = Join-Path $b '.env'
  if ((Test-Path $fa) -and (Test-Path $fb)) {
    if ((Get-Item $fa).LastWriteTimeUtc -gt (Get-Item $fb).LastWriteTimeUtc) {
      Copy-Item $fa $fb -Force
    }
  } elseif (Test-Path $fa) { Copy-Item $fa $fb -Force }
}

$state = @{ at = (Get-Date).ToString('o'); stats = $stats; local = $Local; drive = $Drive }
$state | ConvertTo-Json | Set-Content (Join-Path $Local '.sync-state.json') -Encoding UTF8
Copy-Item (Join-Path $Local '.sync-state.json') (Join-Path $Drive '.sync-state.json') -Force -ErrorAction SilentlyContinue
Write-Host "Sync OK | ->Drive: $($stats.ToDrive) | ->Local: $($stats.ToLocal)"
