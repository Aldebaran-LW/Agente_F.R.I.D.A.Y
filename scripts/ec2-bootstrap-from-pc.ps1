# Bootstrap EC2: clone repo, env, sync agent models, restart gateway
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
$user = if ($vars.AWS_EC2_USER) { $vars.AWS_EC2_USER } else { "ubuntu" }
$key = $vars.AWS_EC2_KEY_PATH
if (-not $host_) { throw "AWS_EC2_HOST vazio no .env" }
if (-not $key -or -not (Test-Path $key)) { throw "AWS_EC2_KEY_PATH invalido: $key" }

$prefixes = @(
  "TELEGRAM_", "OPENROUTER_", "OPENCLAW_", "GOOGLE_", "GITHUB_",
  "MONGODB_", "RENDER_", "HF_", "HEARTBEAT_", "OLLAMA_", "DEEPSEEK_"
)
$ec2Env = Join-Path $env:TEMP "openclaw-ec2.env"
$lines = Get-Content $envFile -Encoding UTF8 | Where-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return $false }
  if ($line -match "^AWS_EC2_") { return $false }
  foreach ($p in $prefixes) { if ($line.StartsWith($p)) { return $true } }
  $false
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($ec2Env, ($lines -join "`n") + "`n", $utf8NoBom)

$remoteSh = Join-Path $PSScriptRoot "ec2-bootstrap-remote.sh"
if (-not (Test-Path $remoteSh)) { throw "Falta $remoteSh" }

Write-Host "==> Enviar .env e script para EC2"
scp -i $key -o StrictHostKeyChecking=accept-new $ec2Env "${user}@${host_}:/tmp/openclaw.env"
scp -i $key -o StrictHostKeyChecking=accept-new $remoteSh "${user}@${host_}:/tmp/ec2-bootstrap-remote.sh"

Write-Host "==> SSH bootstrap ${user}@${host_}"
ssh -i $key -o StrictHostKeyChecking=accept-new $user@$host_ "sed -i 's/\r$//' /tmp/ec2-bootstrap-remote.sh && chmod +x /tmp/ec2-bootstrap-remote.sh && bash /tmp/ec2-bootstrap-remote.sh"

Remove-Item $ec2Env -Force -ErrorAction SilentlyContinue
Write-Host "`nOK. Teste no Telegram: status macofel"
