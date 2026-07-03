# Aplica git pull + fix Telegram na EC2 (le .env: AWS_EC2_*)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $root ".env"
$vars = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
  $t = $_.Trim()
  if ($t -and -not $t.StartsWith("#") -and $t.Contains("=")) {
    $i = $t.IndexOf("=")
    $vars[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
  }
}
$host_ = $vars.AWS_EC2_HOST
if (-not $host_) { $host_ = $vars.OPENCLAW_EC2_HOST }
$user = if ($vars.AWS_EC2_USER) { $vars.AWS_EC2_USER } elseif ($vars.OPENCLAW_EC2_USER) { $vars.OPENCLAW_EC2_USER } else { "ubuntu" }
$key = $vars.AWS_EC2_KEY_PATH
if (-not $key) { $key = $vars.OPENCLAW_EC2_KEY_PATH }
if (-not $key) {
  $defaultKey = Join-Path $root "Chaves\OpenClaw.pem"
  if (Test-Path $defaultKey) { $key = $defaultKey }
}
if (-not $host_) { throw "AWS_EC2_HOST ou OPENCLAW_EC2_HOST vazio no .env" }
if (-not $key -or -not (Test-Path $key)) { throw "AWS_EC2_KEY_PATH invalido: $key" }

$cmd = "set -e; cd /opt/openclaw; git pull origin main || git pull; sudo bash scripts/ec2-sync-now.sh"

Write-Host "==> SSH ${user}@${host_}"
ssh -i $key -o StrictHostKeyChecking=accept-new "${user}@${host_}" $cmd
Write-Host ""
Write-Host "OK. Telegram: /new depois ajuda ou status macofel"