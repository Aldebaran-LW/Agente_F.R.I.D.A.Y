# Dominio customizado (Vercel)

Projeto **agente-openclaw** (Root Directory = `gateway`).

## Dominios em producao

| Dominio | Papel |
|---------|--------|
| **`openclaw.lwdigitalforge.com`** | **API / gateway** — usar em `OPENCLAW_GATEWAY_BASE_URL` |
| **`f.r.i.d.a.y.lwdigitalforge.com`** | Marca F.R.I.D.A.Y. (mesmo deploy; `/office`, `/forge`) |
| `agente-openclaw.vercel.app` | URL Vercel default (testes) |

Todos apontam ao **mesmo** projeto; escolhe **um** host no `.env` (recomendado: `openclaw`).

## Pre-requisitos

- Deploy verde no projeto gateway
- **Vercel Authentication OFF** (senao `/api/health` da 401)

## Adicionar dominio (painel)

1. Projeto **agente-openclaw** → **Settings** → **Domains**
2. **Add** → `openclaw.lwdigitalforge.com` ou `f.r.i.d.a.y.lwdigitalforge.com`
3. DNS no registrador (CNAME → valor do painel Vercel)
4. Aguardar **Valid Configuration** + SSL

## Apos DNS activo

Actualizar **PC `.env`**, **EC2** `~/.openclaw/.env` e **Secrets HF**:

```env
OPENCLAW_GATEWAY_BASE_URL=https://openclaw.lwdigitalforge.com
```

(`f.r.i.d.a.y...` tambem funciona — mesmo backend — mas mantem `openclaw` como canonico para scripts/HF/EC2.)

Testar:

```powershell
Invoke-WebRequest -Uri "https://openclaw.lwdigitalforge.com/api/health" -UseBasicParsing
.\run-basico.ps1
```

## CLI (opcional)

```bash
vercel domains add openclaw.lwdigitalforge.com agente-openclaw
vercel domains inspect openclaw.lwdigitalforge.com
```

Documentacao: https://vercel.com/docs/domains/set-up-custom-domain
