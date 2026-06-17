# Envia chaves LLM/Telegram do .env local para /opt/openclaw/.env na EC2
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
if (-not $host_) { $host_ = "18.191.36.145" }
if (-not $key -or -not (Test-Path $key)) { throw "Chave PEM nao encontrada" }

$prefixes = @("TELEGRAM_", "OPENROUTER_", "OPENCLAW_", "GOOGLE_", "DEEPSEEK_", "HF_", "HUGGINGFACE_", "INFRON_", "KILO_", "GROQ_", "HEARTBEAT_", "EC2_PROFILE")
$skipKeys = @("OPENCLAW_BRAIN_VAULT", "AWS_EC2_KEY_PATH", "OPENCLAW_EC2_HOST", "OPENCLAW_SSH_KEY")
$lines = Get-Content $envFile -Encoding UTF8 | Where-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return $false }
  $key = $line.Split("=", 2)[0].Trim()
  if ($skipKeys -contains $key) { return $false }
  if ($line -match '[\\:][A-Za-z]:\\') { return $false }
  foreach ($p in $prefixes) { if ($line.StartsWith($p)) { return $true } }
  $false
}
$extra = @(
  "OPENCLAW_LLM_PRIMARY=groq",
  "GROQ_MODEL=llama-3.3-70b-versatile",
  "OPENCLAW_SKIP_HF_INFERENCE=1",
  "EC2_PROFILE=minimal",
  "HEARTBEAT_CHECK_HEIMDALL_FLOW=1",
  "HEARTBEAT_AGENT_STALE_MIN=60"
)
$ec2Env = Join-Path $env:TEMP "openclaw-ec2-sync.env"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$body = (($lines + $extra) -join "`n") + "`n"
[System.IO.File]::WriteAllText($ec2Env, $body, $utf8NoBom)

$mergeSh = Join-Path $PSScriptRoot "ec2-merge-env.sh"
Write-Host "==> Sync env LLM/Telegram para EC2"
scp -i $key -o StrictHostKeyChecking=accept-new $ec2Env "${user}@${host_}:/tmp/openclaw-sync.env"
scp -i $key -o StrictHostKeyChecking=accept-new $mergeSh "${user}@${host_}:/tmp/ec2-merge-env.sh"
ssh -i $key -o StrictHostKeyChecking=accept-new "${user}@${host_}" "sed -i 's/\r$//' /tmp/ec2-merge-env.sh && chmod +x /tmp/ec2-merge-env.sh && bash /tmp/ec2-merge-env.sh"
Remove-Item $ec2Env -Force -ErrorAction SilentlyContinue
