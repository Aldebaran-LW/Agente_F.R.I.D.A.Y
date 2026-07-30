# ⚙️ GitHub Actions + Secrets Setup

## 🔐 Secrets Necessários

Adicione no GitHub Repository Settings → Secrets → New Repository Secret:

### Production Secrets

```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
OPENCLAW_AUTOMATION_TOKEN
OLLAMA_BASE_URL
OLLAMA_MODEL
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

### Staging Secrets (opcional, reutilizar acima)

Os mesmos secrets são usados tanto para staging quanto produção.

## 📋 Copiar Secrets

### 1. Cloudflare

```
# API Token — NUNCA commitar no repo!
CLOUDFLARE_API_TOKEN = [OBTENHA DA CLOUDFLARE]

# Account ID
CLOUDFLARE_ACCOUNT_ID = 1b1e73eec84696014b5812225fd026e0
```

### 2. OpenClaw

```bash
OPENCLAW_AUTOMATION_TOKEN = seu-token-secreto-aqui
```

### 3. Ollama

```bash
# URL via Tunnel (depois de configurar)
OLLAMA_BASE_URL = https://ollama.lwdigitalforge.com

# Modelo padrão
OLLAMA_MODEL = qwen2.5:0.5b
```

### 4. Telegram

```bash
# Obter do @BotFather no Telegram
TELEGRAM_BOT_TOKEN = seu-bot-token-aqui

# Seu chat ID pessoal (para notificações)
# Enviar /start para @userinfobot
TELEGRAM_CHAT_ID = seu-chat-id-aqui
```

## 🚀 Adicionar Secrets no GitHub

### Via GitHub Web UI

1. Ir a: https://github.com/Aldebaran-LW/Agente_OpenClaw/settings/secrets/actions
2. Click: "New repository secret"
3. Nome: `CLOUDFLARE_API_TOKEN`
4. Valor: [Cole o token da Cloudflare]
5. Click: "Add secret"
6. Repetir para cada secret

### Via GitHub CLI

```bash
# IMPORTANTE: Nunca cole o token real! Use um placeholder
gh secret set CLOUDFLARE_API_TOKEN --body "[SEU_TOKEN_AQUI]"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "1b1e73eec84696014b5812225fd026e0"
gh secret set OPENCLAW_AUTOMATION_TOKEN --body "seu-token-aqui"
gh secret set OLLAMA_BASE_URL --body "https://ollama.lwdigitalforge.com"
gh secret set OLLAMA_MODEL --body "qwen2.5:0.5b"
gh secret set TELEGRAM_BOT_TOKEN --body "seu-bot-token"
gh secret set TELEGRAM_CHAT_ID --body "seu-chat-id"
```

## ✅ Verificar Secrets

```bash
# Listar secrets (mostra apenas nomes, não valores)
gh secret list
```

## 🔄 Workflow Automático

Depois de adicionar secrets:

1. **Qualquer push para `main`** → Deploy automático em staging
2. **Se staging passar** → Deploy automático em produção
3. **Sucesso** → Notificação via Telegram
4. **Falha** → Alerta via Telegram com link para Actions

## 🧪 Testar Workflow

```bash
# Push de teste (vai disparar workflow)
git add -A
git commit -m "test: CI/CD automation"
git push
```

Depois, ir a: https://github.com/Aldebaran-LW/Agente_OpenClaw/actions

## 📊 Workflow File

O arquivo `.github/workflows/deploy.yml` já está configurado com:

- ✅ Staging: Build + Deploy + Test + Notify
- ✅ Production: Idem + Dependent on staging success
- ✅ Telegram notifications para sucesso/falha

## 🔗 Referências

- [GitHub Secrets Docs](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Actions Docs](https://docs.github.com/en/actions/using-workflows)
- [Telegram Bot API](https://core.telegram.org/bots/api)
