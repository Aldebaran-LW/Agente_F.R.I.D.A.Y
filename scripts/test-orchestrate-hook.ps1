# Testa hook EC2 local ou via URL publica
param(
  [string]$BaseUrl = "http://127.0.0.1:8790",
  [string]$Token = "",
  [string]$Agent = "orchestrator",
  [string]$Task = "ping teste"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $Token) {
  $envFile = Join-Path $root ".env"
  if (Test-Path $envFile) {
    Get-Content $envFile -Encoding UTF8 | ForEach-Object {
      if ($_ -match '^\s*OPENCLAW_(INTERNAL_TOKEN|AUTOMATION_TOKEN)\s*=\s*(.+)$') {
        $script:Token = $matches[2].Trim().Trim('"').Trim("'")
      }
    }
  }
}

$base = $BaseUrl.TrimEnd("/")
Write-Host "GET $base/health" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/health" -Method Get | ConvertTo-Json

$headers = @{ "Content-Type" = "application/json" }
if ($Token) { $headers["Authorization"] = "Bearer $Token" }

$body = @{ agent = $Agent; task = $Task; source = "test-orchestrate-hook" } | ConvertTo-Json
Write-Host "POST $base/task" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/task" -Method Post -Headers $headers -Body $body | ConvertTo-Json -Depth 5
