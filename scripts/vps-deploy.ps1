# Deploy workspace OpenClaw para VPS (lê .env local — não commitar secrets)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) { throw ".env não encontrado em $root" }

$vars = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
  $t = $_.Trim()
  if ($t -and -not $t.StartsWith("#") -and $t.Contains("=")) {
    $i = $t.IndexOf("=")
    $vars[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
  }
}

$host_ = $vars.VPS_HOST
$user = if ($vars.VPS_ROOT_USER) { $vars.VPS_ROOT_USER } else { "root" }
$pass = $vars.VPS_ROOT_PASSWORD
$port = if ($vars.VPS_SSH_PORT) { [int]$vars.VPS_SSH_PORT } else { 22 }

if (-not $host_) { throw "VPS_HOST vazio no .env" }
if (-not $pass) { throw "VPS_ROOT_PASSWORD vazio no .env" }

if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
  Write-Host "A instalar Posh-SSH..."
  Install-Module -Name Posh-SSH -Scope CurrentUser -Force -AllowClobber
}
Import-Module Posh-SSH

$sec = ConvertTo-SecureString $pass -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ($user, $sec)

Write-Host "==> SSH $user@${host_}:$port"
try {
  $session = New-SSHSession -ComputerName $host_ -Port $port -Credential $cred -AcceptKey -Force
} catch {
  Write-Host "ERRO SSH: senha recusada ou servidor indisponivel."
  Write-Host "  1. Painel FreeVPS -> confirmar senha root"
  Write-Host "  2. Atualizar VPS_ROOT_PASSWORD no .env (use aspas se tiver caracteres especiais)"
  Write-Host "  3. Testar: .\scripts\vps-ssh-test.ps1"
  Write-Host "  Guia: docs\VPS-SETUP.md"
  throw
}
if (-not $session) { throw "Falha ao ligar SSH" }

function Invoke-Remote([string]$cmd) {
  $r = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd -TimeOut 600
  if ($r.Output) { $r.Output | ForEach-Object { Write-Host $_ } }
  if ($r.Error) { $r.Error | ForEach-Object { Write-Host $_ -ForegroundColor Yellow } }
  if ($r.ExitStatus -ne 0) { throw "Comando remoto falhou ($($r.ExitStatus)): $cmd" }
}

$remoteBase = "/opt/openclaw"
Invoke-Remote "mkdir -p $remoteBase/agents $remoteBase/skills $remoteBase/scripts"

Write-Host "==> Enviar ficheiros"
$staging = Join-Path $env:TEMP "openclaw-vps-staging"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null

Copy-Item $envFile (Join-Path $staging ".env")
foreach ($rel in @("agents", "skills", "scripts", "POLITICA-SEGURANCA.md", "README.md")) {
  $src = Join-Path $root $rel
  if (Test-Path $src) { Copy-Item $src (Join-Path $staging $rel) -Recurse -Force }
}

Set-SCPItem -ComputerName $host_ -Port $port -Credential $cred -Path "$staging\*" -Destination $remoteBase -AcceptKey -Force -Recursive

$setupSh = Join-Path $PSScriptRoot "vps-openclaw-setup.sh"
Set-SCPItem -ComputerName $host_ -Port $port -Credential $cred -Path $setupSh -Destination "/root/vps-openclaw-setup.sh" -AcceptKey -Force

Write-Host "==> Executar setup no servidor (5-15 min)"
Invoke-Remote "chmod +x /root/vps-openclaw-setup.sh && OPENCLAW_WORKSPACE=$remoteBase OPENCLAW_ENV=$remoteBase/.env bash /root/vps-openclaw-setup.sh"

Write-Host "==> Onboard + gateway"
$onboard = @'
set -a; source /opt/openclaw/.env; set +a
if [ -n "$GOOGLE_API_KEY" ]; then
  openclaw onboard --non-interactive --accept-risk --mode local \
    --workspace /opt/openclaw --auth-choice google-api-key \
    --google-api-key "$GOOGLE_API_KEY" --skip-bootstrap --skip-health || true
fi
systemctl restart openclaw-gateway
sleep 2
systemctl is-active openclaw-gateway
'@ -replace "`r`n", "`n"
Invoke-Remote $onboard

Remove-SSHSession -SessionId $session.SessionId | Out-Null
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }

Write-Host ""
Write-Host "Deploy concluído."
Write-Host "  SSH:  ssh ${user}@${host_}"
Write-Host "  Logs: journalctl -u openclaw-gateway -f"
Write-Host "  UI:   http://${host_}:18789 (se o firewall do provedor permitir)"
