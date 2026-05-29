# Copia friday-prod para Space HF dedicado (ex.: sophia)
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('sophia', 'rebeca', 'senku', 'hefestos')]
  [string]$Agent
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$src = Join-Path $root 'hf-space\friday-prod'
$dst = Join-Path $root "hf-space\$Agent"

if (-not (Test-Path $src)) { throw "Origem em falta: $src" }

$files = @('requirements.txt', 'app.py', 'sync.py', 'agents-config.yaml', 'Dockerfile', 'tools')
foreach ($f in $files) {
  $from = Join-Path $src $f
  if (Test-Path $from) {
    if ((Get-Item $from).PSIsContainer) {
      Copy-Item -Recurse -Force $from (Join-Path $dst 'tools')
    } else {
      Copy-Item -Force $from $dst
    }
  }
}

node (Join-Path $root 'scripts\generate-hf-agents-config.mjs')
Write-Host "[OK] $dst pronto para git push ao Space Aldebaran-LW/$Agent"
Write-Host "     Definir DEFAULT_AGENT=$Agent no Dockerfile ou usar POST /run/$Agent no friday-prod partilhado."
