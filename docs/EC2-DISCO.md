# EC2 — disco quase cheio (heartbeat CRITICO)

## Estado (após cleanup 2026-06-01)

| Antes | Depois |
|-------|--------|
| **0,7% livre** (~44 MB) | **~11% livre** (~751 MB) |
| Uso **100%** | Uso **89%** |

OpenClaw e heartbeat **activos**. Alerta CRITICO deve cessar se livre ≥10%.

---

## Limpeza rápida (SSH)

```powershell
ssh -i "H:\Meu Drive\Projetos\OpenClaw\Chaves\OpenClaw.pem" ubuntu@18.191.36.145
```

```bash
cd /opt/openclaw
sudo git pull origin main
sudo bash scripts/ec2-disk-cleanup.sh
sudo systemctl restart openclaw-heartbeat.timer
df -h /
```

**Do PC (automático):** `.\scripts\ec2-sync-from-pc.ps1`

---

## O que o script remove

- journal systemd (>100M / >3 dias)
- cache apt, `/tmp` antigo
- modelos **Ollama** (~700 MB — stack actual usa HF/gateway)
- logs OpenClaw >7 dias, sessões Telegram >3 dias
- Docker prune (se existir)

---

Perfil **mínimo** (só Telegram + heartbeat, transição para servidor físico): `docs/EC2-MINIMAL.md` · `scripts/ec2-slim-essential.sh`

---

## Aumentar volume EBS (recomendado produção)

Volume actual: **~8 GB** — apertado para OpenClaw + logs + node global.

1. AWS Console → **EC2 → Volumes** → volume da instância
2. **Modify volume** → **16 GB** ou **20 GB**
3. Na EC2:

```bash
lsblk
sudo growpart /dev/nvme0n1 1   # ou /dev/xvda 1 — ver lsblk
sudo resize2fs /dev/nvme0n1p1  # partição ext4
df -h /
```

---

## Diagnóstico manual

```bash
df -h /
sudo du -xh / 2>/dev/null | sort -rh | head -15
journalctl --disk-usage
```

---

## Context overflow (Telegram)

**Não** é disco — é sessão longa. Enviar **`/new`** no bot.

---

## Monitorização

Heartbeat (`openclaw-heartbeat.timer`) alerta se livre <10%.  
Cron: ver `docs/HEARTBEAT.md`.
