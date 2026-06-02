# EC2 - aplicar config dos agentes

Ver `.env`: AWS_EC2_HOST, AWS_EC2_USER, AWS_EC2_KEY_PATH.

## Um comando (PC)

    cd "G:\Meu Drive\Projetos\OpenClaw"
    .\scripts\ec2-ssh-apply.ps1

## Repo vazio ou primeira vez na EC2

    .\scripts\ec2-bootstrap-from-pc.ps1

Clona `/opt/openclaw`, envia `.env` filtrado, aplica modelos OpenRouter e reinicia o gateway.

## Manual SSH

    ssh -i "G:\Meu Drive\Projetos\OpenClaw\Chaves\OpenClaw.pem" ubuntu@18.191.36.145

Na EC2:

    cd /opt/openclaw
    git pull origin main
    sudo bash scripts/ec2-apply-agent-config.sh
    sudo systemctl restart openclaw-gateway
    sudo systemctl status openclaw-gateway

Telegram: status macofel

## Timeout SSH

- EC2 Running no console AWS
- Security Group porta 22 ao teu IP
- Ou EC2 Instance Connect no browser (Connect)

## .env na EC2 (/opt/openclaw/.env)

OPENCLAW_GATEWAY_BASE_URL, OPENCLAW_AUTOMATION_TOKEN, OPENROUTER_API_KEY, TELEGRAM_*

### VP-Peças e heartbeat `heimdall_flow`

O office snapshot do gateway usa `VP_PECAS_URL` para o agente **vp-pecas** (evita “URL não configurada” e `office_ok=false`).

```bash
# Em /opt/openclaw/.env (e no .env do projeto Vercel gateway)
VP_PECAS_URL=https://vp-pecas.vercel.app
MACOFEL_URL=https://www.macofelparapua.com
```

Depois de `git pull` e alterar o `.env`:

```bash
sudo systemctl restart openclaw-gateway
sudo systemctl start openclaw-heartbeat.service
```

Repos GitHub monitorados: **Macofel_2.0**, **VP-Pecas**, **vp-precision-studio** (removido `LWDigitalForge_Texte` — repo 404).