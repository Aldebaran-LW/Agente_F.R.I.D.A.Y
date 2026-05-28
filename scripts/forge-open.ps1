$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $root ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        if (-not [Environment]::GetEnvironmentVariable($key)) {
            [Environment]::SetEnvironmentVariable($key, $line.Substring($eq + 1).Trim())
        }
    }
}
$base = $env:OPENCLAW_GATEWAY_BASE_URL
if (-not $base) { Write-Host "OPENCLAW_GATEWAY_BASE_URL em falta"; exit 1 }
$url = ($base.TrimEnd("/") + "/forge")
Write-Host "A abrir: $url"
Start-Process $url
