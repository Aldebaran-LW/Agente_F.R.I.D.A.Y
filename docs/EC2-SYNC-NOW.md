# EC2 — sync rápido (Jarvis + gateway + Heimdall)

## Do PC (Windows)

No `.env` da raiz:

```env
AWS_EC2_HOST=18.191.36.145
AWS_EC2_USER=ubuntu
AWS_EC2_KEY_PATH=H:\Meu Drive\Projetos\OpenClaw\Chaves\OpenClaw.pem
OPENCLAW_GATEWAY_BASE_URL=https://openclaw.lwdigitalforge.com
OPENCLAW_AUTOMATION_TOKEN=...
```

```powershell
cd "H:\Meu Drive\Projetos\OpenClaw"
.\scripts\ec2-sync-from-pc.ps1
```

## Na EC2 (SSH manual)

```bash
cd /opt/openclaw   # ou onde estiver o clone
git pull origin main
sudo bash scripts/ec2-sync-now.sh
```

## O que o script faz

1. `git pull` → `main` (ex. `ec34730`+)
2. `ec2-apply-agent-config` — SOUL português
3. `ec2-fix-telegram-models` — ops via gateway Vercel
4. Garante `.env`: `OPENCLAW_GATEWAY_BASE_URL`, `HEARTBEAT_*`
5. Activa `openclaw-heartbeat.timer` (Heimdall flow)
6. Testa `GET /api/health` e `/openclaw/innovation/status`

## Depois

Telegram **@LW_Acessor_bot**:

- `ajuda`
- `resumo portfolio`
- `tokens` (Rimuru)

Logs:

```bash
sudo journalctl -u openclaw-gateway -f
```

## Se SSH do PC travar

- Security Group AWS: porta **22** aberta ao teu IP
- Testar: `ssh -i Chaves\OpenClaw.pem -o ConnectTimeout=15 ubuntu@IP hostname`
- Correr os comandos **dentro** da EC2 (consola AWS Session Manager)
