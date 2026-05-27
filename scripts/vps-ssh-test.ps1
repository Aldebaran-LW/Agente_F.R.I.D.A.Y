$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$vars = @{}
Get-Content (Join-Path $root ".env") -Encoding UTF8 | ForEach-Object {
  $t = $_.Trim()
  if ($t -and -not $t.StartsWith("#") -and $t.Contains("=")) {
    $i = $t.IndexOf("=")
    $vars[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
  }
}
Import-Module Posh-SSH
$sec = ConvertTo-SecureString $vars.VPS_ROOT_PASSWORD -AsPlainText -Force
$cred = New-Object PSCredential($vars.VPS_ROOT_USER, $sec)
try {
  $s = New-SSHSession -ComputerName $vars.VPS_HOST -Credential $cred -AcceptKey -Force
} catch {
  Write-Host "ERRO: autenticacao SSH falhou."
  Write-Host "Confirme VPS_ROOT_PASSWORD no .env (igual a senha definida no pedido FreeVPS)."
  Write-Host "Teste manual: ssh $($vars.VPS_ROOT_USER)@$($vars.VPS_HOST)"
  throw
}
$r = Invoke-SSHCommand -SessionId $s.SessionId -Command "uname -a; head -3 /etc/os-release"
$r.Output | ForEach-Object { Write-Host $_ }
Remove-SSHSession -SessionId $s.SessionId | Out-Null
Write-Host "SSH OK"
