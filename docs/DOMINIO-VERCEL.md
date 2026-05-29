# Dominio customizado (Vercel)

Ligar `f.r.i.d.a.y.lwdigitalforge.com` ou `openclaw.lwdigitalforge.com` ao projeto gateway.

## Pre-requisitos

- Projeto Vercel com **Root Directory = `gateway`**
- Deploy verde (`agente-openclaw.vercel.app` ou similar)

## Passos (painel Vercel)

1. Projeto -> **Settings** -> **Domains**
2. **Add** -> `f.r.i.d.a.y.lwdigitalforge.com` (ou subdominio desejado)
3. Copiar instrucoes DNS (CNAME ou A record)
4. No registrador (Cloudflare, etc.):
   - Subdominio: **CNAME** -> `cname.vercel-dns.com` (valor exacto do painel)
   - Apex: **A** 76.76.21.21 (confirmar no painel — pode variar)
5. Aguardar SSL (automatico)
6. **Vercel Authentication OFF** no projeto gateway (senao /api/health da 401)

## Apos DNS activo

Actualizar em **EC2** `/opt/openclaw/.env` e PC `.env`:

```env
OPENCLAW_GATEWAY_BASE_URL=https://f.r.i.d.a.y.lwdigitalforge.com
```

Testar:

```powershell
.\run-basico.ps1
```

## CLI (opcional)

```bash
vercel domains add f.r.i.d.a.y.lwdigitalforge.com nome-do-projeto
vercel domains inspect f.r.i.d.a.y.lwdigitalforge.com
```

Documentacao: https://vercel.com/docs/domains/set-up-custom-domain