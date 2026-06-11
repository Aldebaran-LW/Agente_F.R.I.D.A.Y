# Deploy HF — agora (checklist)

Ordem: **3 perfis** (`core` → `innovation` → `macofel`) + corpus + sync Vercel.

---

## 0. Pré-requisitos (5 min)

1. Token HF com **Write**: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. No `.env` da raiz:

```env
HF_TOKEN=hf_...
HF_USERNAME=Aldebaran-LW
HF_BACKUP_DATASET=Aldebaran-LW/openclaw-backup
HF_CORPUS_DATASET=Aldebaran-LW/openclaw-backup
HF_OPENCLAW_CORE_URL=https://aldebaran-lw-openclaw-core.hf.space
HF_OPENCLAW_INNOVATION_URL=https://aldebaran-lw-openclaw-innovation.hf.space
HF_MACOFEL_SPACE_URL=https://aldebaran-lw-macofel-agent.hf.space
OPENCLAW_GATEWAY_BASE_URL=https://openclaw.lwdigitalforge.com
OPENCLAW_AUTOMATION_TOKEN=...
OPENROUTER_API_KEY=...
```

3. Validar token:

```powershell
cd "H:\Meu Drive\Projetos\OpenClaw"
node scripts/test-hf-token.mjs
```

---

## 1. Criar Spaces no Hub (se ainda não existem)

| Space | Repo HF | SDK |
|-------|---------|-----|
| OpenClaw Core | `Aldebaran-LW/openclaw-core` | Docker, **Private** |
| OpenClaw Innovation | `Aldebaran-LW/openclaw-innovation` | Docker, **Private** |
| Macofel Agent | `Aldebaran-LW/macofel-agent` | Docker, **Private** |

[New Space](https://huggingface.co/new-space?sdk=docker) · Owner: **Aldebaran-LW**.

Dataset: `Aldebaran-LW/openclaw-backup` (Private) — memória + `corpus/`.

---

## 2. Deploy automático

```powershell
cd "H:\Meu Drive\Projetos\OpenClaw"

foreach ($p in @("core","innovation","macofel")) {
  node scripts/generate-hf-agents-config.mjs --profile $p
  node scripts/hf-assemble-space.mjs --profile $p
  node scripts/hf-deploy-space.mjs --profile $p --secrets
}
```

Build no HF: 5–15 min por Space. Logs em *Settings → Build logs*.

---

## 3. Corpus (docs → RAG)

```powershell
node scripts/hf-ingest-corpus.mjs
```

---

## 4. Vercel (rotas HF)

```powershell
node scripts/vercel-sync-hf-env.mjs
```

Deploy gateway: **git push `main`** (não usar CLI do Google Drive). Ver `docs/GATEWAY-VERCEL.md`.

---

## 5. Testes

```powershell
# Health dos Spaces (com HF_TOKEN)
curl -H "Authorization: Bearer $HF_TOKEN" https://aldebaran-lw-openclaw-core.hf.space/health

# Gateway + rotas
node scripts/test-hf-spaces-routing.mjs

# EC2 mínima
.\scripts\ec2-sync-from-pc.ps1
```

Telegram: `/new` → `ajuda`

---

## URLs de produção (referência)

| Serviço | URL |
|---------|-----|
| Gateway | https://openclaw.lwdigitalforge.com |
| HF core | https://aldebaran-lw-openclaw-core.hf.space |
| HF innovation | https://aldebaran-lw-openclaw-innovation.hf.space |
| HF macofel | https://aldebaran-lw-macofel-agent.hf.space |

---

## Legado

| Space | Estado |
|-------|--------|
| `friday-prod` | Substituído — pode dormir no Hub |
| `openclaw-demo` | Monitor legado |

Guia completo: [HF-DEPLOY-FRIDAY.md](./HF-DEPLOY-FRIDAY.md)
