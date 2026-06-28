# MCP read-only — Cursor ↔ Gateway OpenClaw

Expõe ferramentas **somente leitura** do Jarvis no Cursor via MCP stdio.

Política: sem escrita, sem sync catálogo, sem secrets na resposta.

---

## Tools disponíveis

| Tool MCP | Gateway | Descrição |
|----------|---------|-----------|
| `macofel_status` | GET `/openclaw/macofel/status` | Catálogo Macofel |
| `github_aldebaran` | GET `/openclaw/github/status` | Repos GitHub |
| `deploy_health` | GET `/openclaw/deploy/health` | Sites no ar |
| `vercel_status` | GET `/openclaw/vercel/status` | Deployments Vercel |
| `vp_pecas_health` | GET `/openclaw/vp-pecas/health` | Sites VP-Pecas |
| `icaro_validate` | POST `/openclaw/mcp/call` | Validador Ícaro |
| `rimuru_quotas` | GET `/openclaw/rimuru/status` | Quotas LLM |

Catálogo: `GET /openclaw/mcp/tools` (Bearer `OPENCLAW_AUTOMATION_TOKEN`).

---

## Configurar no Cursor

1. Copiar `.cursor/mcp.json.example` → `.cursor/mcp.json`
2. Preencher `OPENCLAW_AUTOMATION_TOKEN` (mesmo valor do `.env`)
3. Reiniciar Cursor ou recarregar MCP

```json
{
  "mcpServers": {
    "openclaw": {
      "command": "node",
      "args": ["scripts/openclaw-mcp-server.mjs"],
      "env": {
        "OPENCLAW_GATEWAY_BASE_URL": "https://agente-open-claw.vercel.app",
        "OPENCLAW_AUTOMATION_TOKEN": "seu_token"
      }
    }
  }
}
```

O script lê também `.env` na raiz se as variáveis não estiverem no `mcp.json`.

---

## Modo local (dev offline)

Com repo completo e dependências gateway:

```powershell
$env:OPENCLAW_MCP_LOCAL = "1"
node scripts/openclaw-mcp-server.mjs
```

Chama `gateway/lib/mcp-tools.mjs` directamente (sem HTTP).

---

## Testar HTTP (pós-deploy)

```powershell
$token = $env:OPENCLAW_AUTOMATION_TOKEN
$base = "https://agente-open-claw.vercel.app"

Invoke-RestMethod -Uri "$base/openclaw/mcp/tools" -Headers @{ Authorization = "Bearer $token" }

Invoke-RestMethod -Uri "$base/openclaw/mcp/call" -Method POST `
  -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
  -Body '{"name":"icaro_validate","arguments":{}}'
```

---

## Implementação

| Ficheiro | Papel |
|----------|-------|
| `gateway/lib/mcp-tools.mjs` | Definições + `callMcpReadTool()` |
| `gateway/lib/openclaw-handlers.mjs` | Rotas `mcp/tools`, `mcp/call` |
| `scripts/openclaw-mcp-server.mjs` | Servidor MCP stdio para Cursor |

---

## Ver também

- [ECOSSISTEMA-CLAUDE-CODE.md](./ECOSSISTEMA-CLAUDE-CODE.md)
- [POLITICA-SEGURANCA.md](../POLITICA-SEGURANCA.md)
