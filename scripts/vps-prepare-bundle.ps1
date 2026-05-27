# Cria ZIP para enviar ao VPS quando SSH funcionar (ou extrair via consola)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$out = Join-Path $env:TEMP "openclaw-vps-bundle.zip"

$staging = Join-Path $env:TEMP "openclaw-vps-bundle"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null

$envSrc = Join-Path $root ".env"
if (Test-Path $envSrc) { Copy-Item $envSrc (Join-Path $staging ".env") }

foreach ($rel in @("agents", "skills", "scripts", "POLITICA-SEGURANCA.md")) {
  $src = Join-Path $root $rel
  if (Test-Path $src) { Copy-Item $src (Join-Path $staging $rel) -Recurse -Force }
}

Copy-Item (Join-Path $PSScriptRoot "vps-openclaw-setup.sh") (Join-Path $staging "vps-openclaw-setup.sh")
Copy-Item (Join-Path $PSScriptRoot "vps-console-install.sh") (Join-Path $staging "vps-console-install.sh")

if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path "$staging\*" -DestinationPath $out -Force
Remove-Item $staging -Recurse -Force

Write-Host "Bundle criado: $out"
Write-Host "Quando SSH OK: scp ou vps-deploy.ps1 envia para /opt/openclaw"
