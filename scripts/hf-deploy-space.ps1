# Deploy hf-space/demo ou friday-prod para Hugging Face Spaces (git push)
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('demo', 'friday-prod')]
  [string]$Space,

  [string]$HfRepo,
  [switch]$ConfigureSecrets,
  [switch]$SkipCopy
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$envFile = Join-Path $root '.env'

if (-not (Test-Path $envFile)) { throw ".env em falta na raiz do OpenClaw" }

$vars = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
  $t = $_.Trim()
  if ($t -and -not $t.StartsWith('#') -and $t.Contains('=')) {
    $i = $t.IndexOf('=')
    $vars[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
  }
}

$hfToken = $vars.HF_TOKEN
if (-not $hfToken) { throw 'HF_TOKEN em falta no .env' }

$repo = if ($HfRepo) { $HfRepo } elseif ($Space -eq 'demo') {
  if ($vars.HF_SPACE_REPO) { $vars.HF_SPACE_REPO } else { 'Aldebaran-LW/openclaw-demo' }
} else {
  if ($vars.HF_FRIDAY_SPACE_REPO) { $vars.HF_FRIDAY_SPACE_REPO } else { 'Aldebaran-LW/friday-prod' }
}

$src = Join-Path $root "hf-space\$Space"
if (-not (Test-Path $src)) { throw "Pasta em falta: $src" }

if ($Space -eq 'friday-prod') {
  Write-Host "==> Regenerar agents-config.yaml" -ForegroundColor Cyan
  node (Join-Path $root 'scripts\generate-hf-agents-config.mjs')
}

$work = Join-Path $env:TEMP "hf-deploy-$Space"
if (Test-Path $work) { Remove-Item -Recurse -Force $work }
New-Item -ItemType Directory -Path $work | Out-Null

$hfUser = $vars.HF_USERNAME
if (-not $hfUser) { $hfUser = ($repo -split '/')[0] }
$cloneUrl = "https://${hfUser}:$hfToken@huggingface.co/spaces/$repo"
Write-Host "==> Clone $repo" -ForegroundColor Cyan
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& git clone $cloneUrl $work 2>&1 | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) { throw "git clone falhou (exit $LASTEXITCODE)" }
$ErrorActionPreference = $prevEap

if (-not $SkipCopy) {
  Write-Host "==> Copiar ficheiros de $src" -ForegroundColor Cyan
  foreach ($dir in @('tools', 'lib')) {
    $dest = Join-Path $work $dir
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  }
  Get-ChildItem $src -Force | Where-Object { $_.Name -notin @('.git', 'desktop.ini', '__pycache__') } | ForEach-Object {
    Copy-Item -Recurse -Force $_.FullName (Join-Path $work $_.Name)
  }
}

Set-Location $work
git add -A
$status = git status --porcelain
if (-not $status) {
  Write-Host "[OK] Nada para commitar - Space ja atualizado?" -ForegroundColor Yellow
} else {
  $msg = "Deploy OpenClaw $Space $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  git commit -m $msg
  Write-Host "==> git push" -ForegroundColor Cyan
  git push
  Write-Host "[OK] Push concluido" -ForegroundColor Green
}

if ($ConfigureSecrets) {
  Set-Location $root
  if ($Space -eq 'demo') {
    $env:HF_SPACE_REPO = $repo
    node scripts/hf-configure-space.mjs
  } else {
    $env:HF_FRIDAY_SPACE_REPO = $repo
    node scripts/hf-configure-friday-prod.mjs
  }
}

Set-Location $root

$slug = $repo -replace '/', '-'
$appUrl = "https://$($slug.ToLower()).hf.space"
Write-Host ""
Write-Host "Space: https://huggingface.co/spaces/$repo" -ForegroundColor Green
Write-Host "App:   $appUrl" -ForegroundColor Green
if ($Space -eq 'demo') { Write-Host "Health: $appUrl/health" }
else { Write-Host ('Health: ' + $appUrl + '/health ; POST ' + $appUrl + '/run/sophia') }
