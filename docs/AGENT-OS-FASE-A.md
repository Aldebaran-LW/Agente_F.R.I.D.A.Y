# Agent OS — Fase A (workflow + skills + audit)

Base operacional no **gateway Vercel** (`gateway/`). Telegram/OpenClaw na EC2 chama `POST /jarvis`.

## Componentes

| Peça | Caminho | Função |
|------|---------|--------|
| Skill manifest | `gateway/skills/manifest.json` | Permissões, timeout, `requiresApproval` |
| Workflows | `gateway/workflows/*.workflow.json` | Planos multi-step declarativos |
| Planner | `gateway/lib/planner.mjs` | Mensagem → workflow ou rota única |
| Engine | `gateway/lib/workflow-engine.mjs` | Executa tasks com deps e timeout |
| Audit | `gateway/lib/audit.mjs` | `traceId` + log estruturado (Vercel logs) |

Referência em `skills/manifest.json` (não usada no deploy).

## Workflows incluídos

### `portfolio-status`

Triggers: `resumo`, `portfolio`, `status completo`, `macofel.*github`, etc.

Tasks (sequenciais): macofel-status → github-aldebaran → deploy-monitor.

Exemplo:

```bash
cd scripts && node jarvis-ask.mjs "resumo portfolio"
```

### `macofel-sync`

Triggers: `sync imagem`, `sincronizar imagens`, …

1. `macofel-status` (sempre corre)
2. `macofel-images-sync` — **bloqueado** até `approved: true` ou mensagem `sim` / `confirmar` / `ok`

```bash
node jarvis-ask.mjs "sync imagens"
node jarvis-ask.mjs "sim"   # com body approved na EC2
```

## API Jarvis (v1.1)

`POST /jarvis`

```json
{
  "message": "resumo portfolio",
  "approved": false
}
```

Resposta inclui: `traceId`, `plan`, `workflow.tasks[]`, `audit`.

`GET /jarvis` lista workflows e skills registadas.

## Testes

```bash
cd gateway && npm test
```

## Próximos passos (Fase B)

- Estado entre mensagens (SQLite/Supabase na EC2, não na Vercel)
- RAG sobre `skills/` + `docs/`
- Langfuse / OTel só nas chamadas LLM
- Dashboard `/office` com `traceId` e tasks

## Sincronizar manifest

Ao alterar skills, editar **`gateway/skills/manifest.json`** e copiar campos relevantes para `skills/manifest.json` (referência no repo).
