# Cursor sessionStart — contexto do segundo cérebro (não bloqueia se falhar)
$ErrorActionPreference = "SilentlyContinue"
$root = "H:\Meu Drive\Projetos\OpenClaw"
$script = Join-Path $root "scripts\brain.mjs"
if (Test-Path $script) {
  node $script standup 2>&1 | Out-Null
}
