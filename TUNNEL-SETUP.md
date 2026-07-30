# Cloudflare Tunnel — Ollama HTTPS Setup

## 📋 Pré-requisitos

- `cloudflared` instalado ([download](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/))
- Domínio delegado no Cloudflare (lwdigitalforge.com)
- Ollama rodando em `localhost:11434`

## 🚀 Setup Tunnel

### 1. Criar o Tunnel

```bash
cloudflared tunnel create ollama-tunnel
```

Isso gera: `~/.cloudflare-warp/` com credenciais

### 2. Criar DNS Record

```bash
cloudflared tunnel route dns ollama-tunnel ollama.lwdigitalforge.com
```

Isso cria automaticamente: `ollama.lwdigitalforge.com → Cloudflare Tunnel`

### 3. Configurar ingress (opcional — arquivo)

Criar `~/.cloudflare-warp/ollama-tunnel.yml`:

```yaml
tunnel: ollama-tunnel
credentials-file: ~/.cloudflare-warp/1b1e73eec84696014b5812225fd026e0.json

ingress:
  - hostname: ollama.lwdigitalforge.com
    service: http://localhost:11434
  - service: http_status:404
```

### 4. Rodar Tunnel

```bash
# Modo foreground (para testes)
cloudflared tunnel run ollama-tunnel

# Modo background (produção — systemd/supervisor)
cloudflared service install
cloudflared service start
```

### 5. Verificar

```bash
# Testar tunnel
curl https://ollama.lwdigitalforge.com/api/tags

# Listar tunnels
cloudflared tunnel list
```

## 🔧 Atualizar Worker

Depois que o tunnel estiver ativo, alterar no `wrangler.toml`:

```toml
[env.staging]
vars = { 
  ENVIRONMENT = "staging"
  OLLAMA_BASE_URL = "https://ollama.lwdigitalforge.com"
}
```

Ou via secret:

```bash
wrangler secret put OLLAMA_BASE_URL --env staging
# → https://ollama.lwdigitalforge.com
```

## 🐧 Linux/macOS — Systemd Service

```bash
# Instalar como serviço
sudo cloudflared service install

# Status
sudo systemctl status cloudflared

# Logs
sudo journalctl -u cloudflared -f
```

## 🪟 Windows — Tarefas Agendadas

```powershell
# Instalar como serviço Windows
cloudflared service install

# Iniciar
Start-Service cloudflared

# Status
Get-Service cloudflared
```

## ✅ Checklist

- [ ] `cloudflared` instalado
- [ ] Tunnel criado (`ollama-tunnel`)
- [ ] DNS configurado (`ollama.lwdigitalforge.com`)
- [ ] Tunnel rodando
- [ ] `curl https://ollama.lwdigitalforge.com/api/tags` funciona
- [ ] Atualizar `OLLAMA_BASE_URL` no worker
- [ ] Deploy worker com nova URL
- [ ] Testar `/health` no worker

## 🔗 Referências

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Tunnel Configuration](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/)
