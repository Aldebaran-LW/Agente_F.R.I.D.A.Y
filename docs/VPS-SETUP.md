# OpenClaw no VPS (45.147.46.122)

## Caminho A — Consola web (sem SSH no PC) **use agora**

1. Painel **FreeVPS** → seu VPS → **Consola / VNC / noVNC**
2. Login: `root` + senha do **painel** (repor senha se precisar)
3. Abra no PC: `scripts\vps-console-install.sh`
4. Copie **todo** o ficheiro e cole na consola → Enter
5. Quando terminar (~10 min):

```bash
nano /opt/openclaw/.env
```

Cole as chaves do seu `.env` local (Telegram, Google, GitHub, etc.).

```bash
set -a; source /opt/openclaw/.env; set +a
openclaw onboard --non-interactive --accept-risk --mode local \
  --workspace /opt/openclaw --auth-choice google-api-key \
  --google-api-key "$GOOGLE_API_KEY" --skip-bootstrap --skip-health
systemctl start openclaw-gateway
systemctl status openclaw-gateway
```

---

## Caminho B — SSH no PC (quando a senha estiver certa)

1. Atualize `.env`:

```env
VPS_ROOT_PASSWORD="senha_do_painel"
```

2. Teste:

```powershell
.\scripts\vps-ssh-test.ps1
```

3. Deploy completo:

```powershell
.\scripts\vps-deploy.ps1
```

4. Opcional — ZIP local para referência:

```powershell
.\scripts\vps-prepare-bundle.ps1
```

---

## Heartbeat (alertas de saude)

Depois do `.env` com `TELEGRAM_BOT_TOKEN` e `TELEGRAM_ADMIN_CHAT_ID`:

```bash
sudo bash /opt/openclaw/scripts/install-heartbeat-timer.sh
python3 /opt/openclaw/scripts/heartbeat.py --dry-run
```

Guia completo: `docs/HEARTBEAT.md`

---

## Depois de tudo a correr

| Comando | Uso |
|---------|-----|
| `journalctl -u openclaw-gateway -f` | Logs em tempo real |
| `systemctl restart openclaw-gateway` | Reiniciar gateway |
| `journalctl -u openclaw-heartbeat.service -n 20` | Ultimo heartbeat |
| `http://45.147.46.122:18789` | UI (se firewall do provedor permitir) |

**Domínio:** `openclaw.lwdigitalforge.com` fica na **Vercel**. O VPS usa o IP.

---

## Atualizar senha depois

1. Painel FreeVPS → reset root password  
2. `.env` → `VPS_ROOT_PASSWORD="nova_senha"`  
3. `.\scripts\vps-ssh-test.ps1`
