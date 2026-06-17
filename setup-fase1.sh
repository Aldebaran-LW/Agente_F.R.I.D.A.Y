#!/usr/bin/env bash
# ============================================================
# setup-fase1.sh — OpenClaw Fase 1 (local ou EC2 Ubuntu)
# Uso: bash setup-fase1.sh [--ec2]
# ============================================================
set -euo pipefail

EC2_MODE=false
[[ "${1:-}" == "--ec2" ]] && EC2_MODE=true

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERRO]${NC}  $*"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   OpenClaw — Setup Fase 1                ║${NC}"
echo -e "${CYAN}║   (Gateway + Jarvis básico)              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Node.js ──────────────────────────────────────────────
info "Verificando Node.js..."
if ! command -v node &>/dev/null; then
  if $EC2_MODE; then
    info "Instalando Node.js 20 via nvm..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20 && nvm use 20
  else
    error "Node.js não encontrado. Instale em https://nodejs.org (>=18)"
  fi
fi

ok "Node.js $(node -e 'console.log(process.version)')"

# ── 2. .env ─────────────────────────────────────────────────
info "Verificando .env..."
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    warn ".env criado a partir do .env.example. PREENCHA antes de continuar:"
    echo ""
    echo "  Mínimo para Fase 1:"
    echo "  OPENCLAW_AUTOMATION_TOKEN=<token_secreto>"
    echo "  OPENCLAW_GATEWAY_BASE_URL=https://openclaw.lwdigitalforge.com"
    echo ""
    echo "  Para LLM (Fase 2 / Telegram):"
    echo "  GROQ_API_KEY=<key_do_groq>"
    echo "  TELEGRAM_BOT_TOKEN=<token_do_bot>"
    echo "  TELEGRAM_ADMIN_CHAT_ID=<seu_chat_id>"
    echo ""
    read -rp "  Pressione ENTER após editar o .env (ou Ctrl+C para sair)..."
  else
    error ".env.example não encontrado. Verifique se está na raiz do projeto."
  fi
else
  ok ".env já existe"
fi

# ── 3. Validar variáveis mínimas ────────────────────────────
info "Validando variáveis mínimas..."
# shellcheck source=.env
set -o allexport; source .env; set +o allexport

MISSING=()
[ -z "${OPENCLAW_AUTOMATION_TOKEN:-}" ] && MISSING+=("OPENCLAW_AUTOMATION_TOKEN")
[ -z "${OPENCLAW_GATEWAY_BASE_URL:-}" ] && MISSING+=("OPENCLAW_GATEWAY_BASE_URL")

if [ ${#MISSING[@]} -gt 0 ]; then
  error "Variáveis obrigatórias não preenchidas no .env: ${MISSING[*]}"
fi
ok "Variáveis mínimas presentes"

# ── 4. Dependências ─────────────────────────────────────────
info "Instalando dependências (scripts/)..."
if [ -f "scripts/package.json" ]; then
  (cd scripts && npm install --silent)
  ok "Dependências instaladas"
else
  warn "scripts/package.json não encontrado — pulando npm install"
fi

# ── 5. Validar config dos agentes ───────────────────────────
if [ -f "scripts/validate-agent-config.mjs" ]; then
  info "Validando config.yaml dos agentes..."
  node scripts/validate-agent-config.mjs && ok "Configs dos agentes OK" || warn "Configs com avisos — veja acima"
fi

# ── 6. Check básico (smoke test gateway) ────────────────────
info "Rodando smoke test do gateway (check-basico.js)..."
echo ""
node scripts/check-basico.js
echo ""

# ── 7. EC2: configurações extras ────────────────────────────
if $EC2_MODE; then
  info "Modo EC2: configurando extras..."

  # PM2 para manter processos vivos
  if ! command -v pm2 &>/dev/null; then
    npm install -g pm2 --silent
    ok "PM2 instalado"
  fi

  # Verificar se há script de hooks
  if [ -f "scripts/setup-ec2-hooks.sh" ]; then
    info "Rodando setup-ec2-hooks.sh..."
    bash scripts/setup-ec2-hooks.sh
  fi

  ok "EC2 configurado"
fi

# ── Resumo ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Fase 1 pronta!                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Próximos passos:"
echo "  • Painel:    ${OPENCLAW_GATEWAY_BASE_URL}/office"
echo "  • Forge 3D:  ${OPENCLAW_GATEWAY_BASE_URL}/forge"
echo "  • Fase 2:    configurar TELEGRAM_BOT_TOKEN + EC2 orchestrator"
echo ""
echo "  Atalhos:"
echo "  npm run basico   → smoke test completo"
echo "  npm run validate → valida configs dos agentes"
echo "  npm run doctor   → basico + validate"
echo ""
