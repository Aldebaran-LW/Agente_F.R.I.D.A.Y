# Base de dados central — Supabase (OpenClaw Hub)

## Papel

| Base | Uso |
|------|-----|
| **Supabase (Postgres)** | Aprovações, audit Jarvis, sessões Telegram, snapshots, aprendizagens |
| **MongoDB** | Só Macofel catálogo (via gateway/API) |
| **Postgres Macofel** | App Macofel_2.0 — **outro** projeto Supabase |

**Escritor único:** gateway Vercel (`SUPABASE_SERVICE_ROLE_KEY`). EC2 e HF chamam o gateway — não guardam a service role.

## 1. Criar projeto Supabase

1. Projeto Supabase: **`LW_Digital_Forge`** (`wwwwyuwighdehmvnolrl`, São Paulo)  
   — plano free tem limite de 2 projetos; tabelas OpenClaw vivem neste projeto.
2. **SQL** (já aplicável via CLI):
   ```powershell
   # Tokens em Chaves/Tokens.txt (SUPABASE_ACCESS_TOKEN)
   npx supabase link --project-ref wwwwyuwighdehmvnolrl --yes
   npx supabase db query --linked -f supabase/migrations/001_openclaw_hub.sql
   ```
   Ou **SQL Editor** → colar `supabase/migrations/001_openclaw_hub.sql`
3. **Settings → API** → copiar:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Variáveis na Vercel (projeto `gateway`)

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Adicionar em `gateway/.env.example`. **Nunca** na EC2, Telegram nem client.

## 3. Tabelas

| Tabela | Conteúdo |
|--------|----------|
| `approval_requests` | Pedidos sync/deploy pendentes |
| `workflow_runs` | Cada `POST /jarvis` (trace_id único) |
| `conversation_sessions` | Sessão por canal+peer (Telegram) |
| `snapshots` | Cache office/macofel/github/deploy |
| `agent_learnings` | Notas dos agentes (gateway, EC2, HF) |

View: `latest_snapshots` — último snapshot por `kind`.

RLS activo sem políticas públicas → só `service_role` acede.

## 4. Rotas gateway

Todas com `Authorization: Bearer OPENCLAW_AUTOMATION_TOKEN`.

| Método | Rota | Função |
|--------|------|--------|
| GET | `/openclaw/hub/health` | Supabase configurado e acessível |
| GET | `/openclaw/hub/recent?limit=20` | Últimos runs, learnings, aprovações pendentes |
| POST | `/openclaw/hub/ingest` | Escrita genérica (EC2, HF, scripts) |

### POST /openclaw/hub/ingest

```json
{
  "type": "learning",
  "data": {
    "agent_id": "macofel",
    "content": "Dataset HF X relevante para imagens",
    "source": "hf",
    "metadata": { "url": "https://huggingface.co/..." }
  }
}
```

Tipos: `workflow_run` · `snapshot` · `learning` · `approval_request` · `approval_resolve` · `session_touch`

### Integração automática

- **POST /jarvis** → grava `workflow_runs` (+ `conversation_sessions` se enviar `peer_id` / `chat_id` no body)
- **GET /openclaw/office/status** → grava snapshot `office`

## 5. Setup local + teste

```powershell
node scripts/setup-supabase-hub-env.mjs   # gateway/.env
node scripts/test-hub-health.mjs          # ping Supabase + GET hub/health remoto
```

Na **Vercel** (Settings → Environment Variables), copiar de `gateway/.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Redeploy do projeto `gateway` — sem deploy, `/openclaw/hub/health` responde **404**.

## 6. Exemplos curl

```bash
BASE=https://agente-openclaw.vercel.app
TOKEN=seu_OPENCLAW_AUTOMATION_TOKEN

curl -s -H "Authorization: Bearer $TOKEN" "$BASE/openclaw/hub/health"

curl -s -H "Authorization: Bearer $TOKEN" "$BASE/openclaw/hub/recent?limit=10"

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"learning","data":{"agent_id":"research","content":"Nota de teste","source":"script"}}' \
  "$BASE/openclaw/hub/ingest"
```

## 7. Fluxo alvo

```txt
Telegram → EC2 (OpenClaw) → Gateway Vercel → APIs externas
                │                    │
                │                    └──► Supabase (hub)
                └── POST /jarvis (opcional peer_id)
```

HF: em vez de só Dataset, podes enviar learnings:

```powershell
# futuro: script que chama hub/ingest em vez de só HF Dataset
```

## 8. Migração HF Dataset → Supabase

| Antes | Depois |
|-------|--------|
| `hf-ingest-learning.mjs` → Dataset | `POST /openclaw/hub/ingest` type `learning` |
| `hf-backup-upload.mjs` snapshots | `snapshot` via gateway ou office/status |

Manter Dataset como backup frio; Supabase = consulta operacional.

## Links

- SQL: `supabase/migrations/001_openclaw_hub.sql`
- Código: `gateway/lib/hub-store.mjs`, `gateway/lib/supabase.mjs`
