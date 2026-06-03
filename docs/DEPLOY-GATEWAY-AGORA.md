# Deploy gateway — checklist rápida

Alterações nos Comandos 2–6 só aparecem no Telegram **depois** de um deploy do projeto Vercel `agente-openclaw` (pasta `gateway/`).

## 1. Preparar bundle (local)

```powershell
cd gateway
node scripts/prepare-vercel.mjs
```

## 2. Publicar (escolhe uma)

### A — Git push (recomendado se o repo está ligado à Vercel)

```powershell
cd "h:\Meu Drive\Projetos\OpenClaw"
git add gateway/ scripts/ docs/ data/
git commit -m "feat(jarvis): contactos, preferências, propostas, /quotas, /office, workflow vendas"
git push origin main
```

A Vercel faz deploy automático em ~1–2 min.

### B — Vercel CLI (login uma vez)

```powershell
cd gateway
npx vercel@latest login
npx vercel@latest deploy --prod
```

Na primeira vez abre o browser com código OAuth.

## 3. Validar produção

```powershell
cd scripts
node check-basico.js
node jarvis-ask.mjs "contato listar"
node jarvis-ask.mjs "/quotas"
```

**Esperado após deploy:**

| Comando | Resposta |
|---------|----------|
| `contato listar` | Lista de contactos (não `clarify`) |
| `/quotas` | Rimuru quotas |
| `preferencia listar` | Preferências |
| `propostas` | Pipeline HF |
| Ajuda | Menciona `/quotas`, contactos, propostas |

## 4. BotFather (Telegram)

Em [@BotFather](https://t.me/BotFather) → teu bot → **Edit Commands**:

```
status - Catálogo Macofel
quotas - Consumo APIs / LLM (Rimuru)
office - Saúde dos agentes (Heimdall)
github - Repos Aldebaran
sites - Sites no ar
resumo - Portfolio completo
lembrete - Menu WhatsApp
```

## 5. EC2 (se o hook ainda devolve clarify)

O hook na EC2 usa o **gateway em produção**. Não precisas redeploy da EC2 — só garantir que `.env` tem:

- `OPENCLAW_GATEWAY_BASE_URL` = URL do gateway (ex. `https://openclaw.lwdigitalforge.com`)
- `OPENCLAW_AUTOMATION_TOKEN` = igual à Vercel

Teste na EC2:

```bash
node scripts/openclaw-jarvis-hook.mjs "contato listar"
echo $?   # 0 = Jarvis tratou
```

## 6. WhatsApp sandbox (opcional)

1. `contato adicionar joao +5511… amigo`
2. João envia `join <código>` ao número Twilio sandbox
3. `enviar joao "teste" amanhã 10:00` → `sim`
4. `cat data/scheduled-whatsapp.json` — campo `to` com o número do contacto

Variáveis na EC2: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_TO`.
