# Pipeline Sophia + Rebeca + Senku (OpenClaw inovacao)
# Uso: .\scripts\roda-pesquisa.ps1 -Topic "ferramentas HF gratuitas"
#      .\scripts\roda-pesquisa.ps1 -Topic "melhorias forge" -DryRun

param(
  [string]$Topic = "ferramentas IA gratuitas para OpenClaw",
  [ValidateSet('all', 'sophia', 'rebeca', 'senku')]
  [string]$Stage = 'all',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$args = @('scripts/innovation-pipeline.mjs', '--topic', $Topic, '--stage', $Stage)
if ($DryRun) { $args += '--dry-run' }

Write-Host "OpenClaw — roda-pesquisa ($Stage)" -ForegroundColor Cyan
node @args
