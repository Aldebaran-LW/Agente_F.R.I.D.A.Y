# Envia e executa ec2-sync-now.sh na EC2 (Windows)
# Uso: .\scripts\ec2-sync-from-pc.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root ".env"
$host_ = $null
$user = "ubuntu"
$key = $null

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*AWS_EC2_HOST\s*=\s*(.+)\s*$' -and $_ -notmatch '^\s*#') { $host_ = $Matches[1].Trim().Trim('"') }
    if ($_ -match '^\s*AWS_EC2_USER\s*=\s*(.+)\s*$' -and $_ -notmatch '^\s*#') { $user = $Matches[1].Trim().Trim('"') }
    if ($_ -match '^\s*AWS_EC2_KEY_PATH\s*=\s*(.+)\s*$' -and $_ -notmatch '^\s*#') { $key = $Matches[1].Trim().Trim('"') }
  }
}

if (-not $host_) { Write-Host "Defina AWS_EC2_HOST no .env" -ForegroundColor Red; exit 1 }
if (-not $key -or -not (Test-Path $key)) { Write-Host "Defina AWS_EC2_KEY_PATH (.pem) no .env" -ForegroundColor Red; exit 1 }

$script = Join-Path $root "scripts\ec2-sync-now.sh"
$remote = "/tmp/ec2-sync-now.sh"
$target = "${user}@${host_}"
$sshOpts = @("-i", $key, "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=20")

Write-Host "==> Copiar script para EC2 $host_" -ForegroundColor Cyan
& scp @sshOpts $script "${target}:${remote}"

Write-Host "==> Executar (sudo) na EC2" -ForegroundColor Cyan
& ssh @sshOpts $target "sed -i 's/\r$//' $remote && chmod +x $remote && sudo bash $remote"

Write-Host ""
Write-Host "Concluido. Testa no Telegram: ajuda" -ForegroundColor Green
