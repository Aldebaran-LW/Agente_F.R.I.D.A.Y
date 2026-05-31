# Deploy HF — agora (checklist)

Ordem recomendada: **demo** (monitor) → **friday-prod** (Sophia…Hefestos). Keepalive do demo é interno (`KEEPALIVE_MS`).

---

## 0. Pré-requisitos (5 min)

1. Token HF com permissão **Write**: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. No `.env` da raiz do OpenClaw:

```env
HF_TOKEN=hf_...
HF_USERNAME=Aldebaran-LW
HF_SPACE_REPO=Aldebaran-LW/openclaw-demo
HF_FRIDAY_SPACE_REPO=Aldebaran-LW/friday-prod
HF_BACKUP_DATASET=Aldebaran-LW/openclaw-backup
OPENCLAW_GATEWAY_BASE_URL=https://openclaw.lwdigitalforge.com
OPENCLAW_AUTOMATION_TOKEN=...
OPENROUTER_API_KEY=...
```

3. Validar:

```powershell
cd "H:\Meu Drive\Projetos\OpenClaw"
node scripts/test-hf-token.mjs
```

---

## 1. Criar Spaces no Hub (se ainda não existem)

| Space | Link | SDK |
|-------|------|-----|
| openclaw-demo | [new-space](https://huggingface.co/new-space?sdk=docker) | Docker, **Private** |
| friday-prod | idem | Docker, **Private** |

Owner: **Aldebaran-LW** (org). Nomes exactos como no `.env`.

Dataset (memória): [new-dataset](https://huggingface.co/new-dataset) → `openclaw-backup` (Private).

---

## 2. Deploy automático (PowerShell)

```powershell
cd "H:\Meu Drive\Projetos\OpenClaw"

# A) Monitor 4 cérebros + painel
.\scripts\hf-deploy-space.ps1 -Space demo -ConfigureSecrets

# B) Protótipo inovação (Sophia, Rebeca, Senku, Hefestos)
.\scripts\hf-deploy-space.ps1 -Space friday-prod -ConfigureSecrets
```

O script: regenera `agents-config.yaml` (friday-prod), clona o Space, copia `hf-space/*`, `git push`, opcionalmente secrets.

**Build no HF:** 5–15 min. Acompanhar em *Settings → Build logs*.

---

## 3. Deploy manual (alternativa)

```powershell
git clone https://huggingface.co/spaces/Aldebaran-LW/openclaw-demo
Copy-Item -Recurse "H:\Meu Drive\Projetos\OpenClaw\hf-space\demo\*" .\openclaw-demo\
cd openclaw-demo
git add .
git commit -m "Deploy demo OpenClaw"
git push
```

(Repetir para `friday-prod` com `hf-space/friday-prod/`.)

No primeiro push o Git pede credenciais: **username** = conta HF, **password** = `HF_TOKEN`.

---

## 4. Secrets (se não usou `-ConfigureSecrets`)

```powershell
node scripts/hf-configure-space.mjs
node scripts/hf-configure-friday-prod.mjs
```

---

## 5. Testar

| Space | URL |
|-------|-----|
| demo | https://aldebaran-lw-openclaw-demo.hf.space/ |
| demo health | …/health |
| friday-prod | https://aldebaran-lw-friday-prod.hf.space/health |
| Sophia | `POST …/run/sophia` body `{"task":"teste"}` |

Via Friday (Vercel), com EC2/HF configurados:

```powershell
# precisa OPENCLAW_AUTOMATION_TOKEN no .env
curl -H "Authorization: Bearer TOKEN" -X POST "https://openclaw.lwdigitalforge.com/openclaw/orchestrate" -d "{\"agent\":\"sophia\",\"task\":\"teste HF\"}"
```

---

## 6. Keepalive e monitor (demo)

- **Interno (já no deploy):** `KEEPALIVE_MS=240000` — refresca gateway a cada 4 min.
- **Alerta opcional:** [cron-job.org](https://cron-job.org) ou cron na EC2 → GET `https://aldebaran-lw-openclaw-demo.hf.space/health` a cada 5 min.

Ver secção 5 em [HF-DEPLOY-FRIDAY.md](./HF-DEPLOY-FRIDAY.md).

---

## Estado actual nesta máquina

Se `test-hf-token` falhar com **HF_TOKEN definido** → preencher `.env` e repetir o passo 2.

Guia completo: [HF-DEPLOY-FRIDAY.md](./HF-DEPLOY-FRIDAY.md) · Moradias: [MAPAS-RESIDENCIAS.md](./MAPAS-RESIDENCIAS.md)
