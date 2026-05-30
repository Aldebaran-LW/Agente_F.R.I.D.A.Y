# EC2 — webhook Orchestrate + nginx HTTPS

Expõe o hook **:8790** para o gateway Vercel (`POST /openclaw/orchestrate`) com TLS, sem abrir o Forge **:8787** ao mundo (túnel SSH continua recomendado para `/forge`).

Mapa geral: [MAPAS-RESIDENCIAS.md](./MAPAS-RESIDENCIAS.md)

---

## Portas

| Porta | Serviço | Exposição |
|-------|---------|-----------|
| **8787** | Digital Forge (`forge-ws-server.mjs`) | `127.0.0.1` + túnel SSH |
| **8900** | ClawMetry (`openclaw-clawmetry.service`) | `127.0.0.1` + túnel SSH |
| **8790** | Orchestrate hook (`ec2-orchestrate-hook.mjs`) | `127.0.0.1` + nginx **443** |
| **443** | nginx | Público (`/orchestrate/*`) |

---

## 1. Instalar na EC2 (SSH)

```bash
export OPENCLAW_REPO=$HOME/Agente_OpenClaw   # ou /opt/openclaw
cd "$OPENCLAW_REPO"

# Forge + Orchestrate + ClawMetry (systemd user)
bash scripts/setup-ec2-hooks.sh

# Ativar orchestrate
systemctl --user daemon-reload
systemctl --user enable --now openclaw-orchestrate
systemctl --user enable --now openclaw-forge        # opcional
systemctl --user enable --now openclaw-clawmetry    # opcional — :8900

# Teste local
curl -s http://127.0.0.1:8790/health
```

Garantir que `~/.openclaw/.env` tem o **mesmo** token que a Vercel:

```env
OPENCLAW_AUTOMATION_TOKEN=...
# ou
OPENCLAW_INTERNAL_TOKEN=...
```

`loginctl enable-linger $USER` — para systemd user sobreviver após logout.

---

## 2. nginx + HTTPS (root)

```bash
# DNS: ec2-hooks.lwdigitalforge.com -> IP elastico da EC2
export EC2_HOOKS_DOMAIN=ec2-hooks.lwdigitalforge.com
export CERTBOT_EMAIL=seu@email.com
sudo bash scripts/install-nginx-ec2-hooks.sh
```

URLs:

| URL | Uso |
|-----|-----|
| `https://ec2-hooks…/orchestrate/health` | Health |
| `https://ec2-hooks…/orchestrate/task` | **JARVIS_EC2_WEBHOOK_URL** na Vercel |

---

## 3. Vercel (gateway)

No projeto **gateway** → Environment Variables:

```env
JARVIS_EC2_WEBHOOK_URL=https://ec2-hooks.lwdigitalforge.com/orchestrate/task
OPENCLAW_INTERNAL_TOKEN=<igual à EC2>
ORCHESTRATE_TIMEOUT_MS=8000
HF_FRIDAY_PROD_URL=https://aldebaran-lw-friday-prod.hf.space
```

Redeploy Vercel após gravar.

---

## 4. Testes

**EC2 local:**

```bash
curl -s http://127.0.0.1:8790/health
curl -s -X POST http://127.0.0.1:8790/task \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent":"orchestrator","task":"ping"}'
```

**Via nginx:**

```bash
curl -s https://ec2-hooks.lwdigitalforge.com/orchestrate/health
```

**Via Friday (Vercel):**

```bash
curl -s -X POST "https://openclaw.lwdigitalforge.com/openclaw/orchestrate" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"sophia\",\"task\":\"teste roteamento\"}"
```

Resposta esperada para Sophia: encaminhamento para HF (`HF_FRIDAY_PROD_URL` configurado).

---

## 5. Windows — deploy remoto

```powershell
.\scripts\vps-ssh-test.ps1
# Depois na EC2 (sessao SSH):
bash ~/Agente_OpenClaw/scripts/setup-ec2-hooks.sh
```

Ou copiar repo com `.\scripts\vps-deploy.ps1` e correr os scripts acima.

---

## 6. systemd (referência)

Unidades **user** em `~/.config/systemd/user/`:

- `openclaw-forge.service` — porta 8787
- `openclaw-orchestrate.service` — porta 8790
- `openclaw-clawmetry.service` — porta 8900 ([DASHBOARDS-VISUAIS.md](./DASHBOARDS-VISUAIS.md))

```bash
systemctl --user status openclaw-orchestrate
journalctl --user -u openclaw-orchestrate -f
```

---

## Segurança

- Hook escuta **127.0.0.1**; só nginx fala com a Internet.
- Bearer obrigatório se `OPENCLAW_INTERNAL_TOKEN` / `OPENCLAW_AUTOMATION_TOKEN` definido.
- Não abrir **8787** no Security Group (usar `forge-tunnel.ps1` no PC).
- Security Group AWS: **22**, **443** (e **80** só para ACME).

---

## Resolução de problemas

| Sintoma | Acção |
|---------|--------|
| 502 na Vercel | EC2 hook parado — `systemctl --user start openclaw-orchestrate` |
| 401 | Token Vercel ≠ EC2 `.env` |
| 504 timeout | Tarefa >8s — usar fila async; Jarvis processa na EC2 |
| certbot falha | DNS ainda não propagou; repetir `certbot --nginx` |

---

## Ver também

- [DIGITAL-FORGE-FRIDAY.md](./DIGITAL-FORGE-FRIDAY.md) — Forge :8787
- [MAPAS-RESIDENCIAS.md](./MAPAS-RESIDENCIAS.md)
