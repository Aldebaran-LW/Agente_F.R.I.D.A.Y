# Envia chaves LLM/Telegram do .env local para /opt/openclaw/.env na EC2
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $root ".env"
$host_ = $null
$user = "ubuntu"
$sshKey = $null

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*AWS_EC2_HOST\s*=\s*(.+)\s*$' -and $_ -notmatch '^\s*#') { $host_ = $Matches[1].Trim().Trim('"') }
    if ($_ -match '^\s*AWS_EC2_USER\s*=\s*(.+)\s*$' -and $_ -notmatch '^\s*#') { $user = $Matches[1].Trim().Trim('"') }
    if ($_ -match '^\s*AWS_EC2_KEY_PATH\s*=\s*(.+)\s*$' -and $_ -notmatch '^\s*#') { $sshKey = $Matches[1].Trim().Trim('"') }
  }
}

if (-not $host_) { $host_ = "18.191.36.145" }
if ($sshKey -and -not (Test-Path $sshKey)) {
  Write-Host "[AVISO] AWS_EC2_KEY_PATH inexistente: $sshKey" -ForegroundColor Yellow
  $sshKey = $null
}
if (-not $sshKey) {
  $defaultKey = Join-Path $root "Chaves\OpenClaw.pem"
  if (Test-Path $defaultKey) { $sshKey = $defaultKey }
}
if (-not $sshKey -or -not (Test-Path $sshKey)) { throw "Chave PEM nao encontrada (Chaves\OpenClaw.pem)" }

$prefixes = @("TELEGRAM_", "OPENROUTER_", "OPENCLAW_", "GOOGLE_", "DEEPSEEK_", "HF_", "HUGGINGFACE_", "INFRON_", "KILO_", "GROQ_", "HEARTBEAT_", "EC2_PROFILE")
$skipKeys = @("OPENCLAW_BRAIN_VAULT", "AWS_EC2_KEY_PATH", "OPENCLAW_EC2_HOST", "OPENCLAW_SSH_KEY")
$lines = Get-Content $envFile -Encoding UTF8 | Where-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return $false }
  $envKey = $line.Split("=", 2)[0].Trim()
  if ($skipKeys -contains $envKey) { return $false }
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
scp -i $sshKey -o StrictHostKeyChecking=accept-new $ec2Env "${user}@${host_}:/tmp/openclaw-sync.env"
scp -i $sshKey -o StrictHostKeyChecking=accept-new $mergeSh "${user}@${host_}:/tmp/ec2-merge-env.sh"
ssh -i $sshKey -o StrictHostKeyChecking=accept-new "${user}@${host_}" "sed -i 's/\r$//' /tmp/ec2-merge-env.sh && chmod +x /tmp/ec2-merge-env.sh && bash /tmp/ec2-merge-env.sh && sudo systemctl restart openclaw-gateway && sleep 2 && sudo systemctl is-active openclaw-gateway"
Remove-Item $ec2Env -Force -ErrorAction SilentlyContinue
