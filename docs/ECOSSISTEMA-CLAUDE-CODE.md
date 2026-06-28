# Ecossistema Claude Code — curadoria OpenClaw

Mapa dos recursos externos avaliados para o portfólio Aldebaran-LW.  
**Regra:** cherry-pick com revisão contra `POLITICA-SEGURANCA.md` — nunca install em massa.

Ver também: [MCP-CURSOR-OPENCLAW.md](./MCP-CURSOR-OPENCLAW.md) · [MATRIZ-AGENTE-FERRAMENTAS.md](./MATRIZ-AGENTE-FERRAMENTAS.md)

---

## Camadas

| Camada | Recursos | Papel |
|--------|----------|-------|
| **Catálogos** | [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code), [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills), [awesomeclaude.ai](https://awesomeclaude.ai/) | Descobrir skills/MCP |
| **Pacotes** | [Claude-Command-Suite](https://github.com/qdhenry/Claude-Command-Suite), [wshobson/commands](https://github.com/wshobson/commands), [feiskyer/claude-code-settings](https://github.com/feiskyer/claude-code-settings) | Workflows dev |
| **Meta-harness** | [Ruflo](https://github.com/ruvnet/ruflo) | Swarm/memória local (não adoptar completo) |

---

## O que já adoptámos no OpenClaw

| Origem | Adaptação | Onde |
|--------|-----------|------|
| spec-kit (feiskyer) | `openclaw-spec` | `.cursor/skills/openclaw-spec/` |
| code-review (Command Suite / wshobson) | `openclaw-code-review` | `.cursor/skills/openclaw-code-review/` |
| testgen pattern | Ícaro executor | `scripts/icaro-test-suite.mjs`, `gateway/lib/icaro.mjs` |
| MCP tools | Gateway read-only | `gateway/lib/mcp-tools.mjs`, `scripts/openclaw-mcp-server.mjs` |

---

## Skills OpenClaw (domínio — manter)

| Skill | Agente | Executor |
|-------|--------|----------|
| `macofel-status` | macofel | gateway |
| `github-aldebaran` | heimdall | gateway |
| `deploy-monitor` | heimdall | gateway |
| `security-audit` | veldora | gateway + script |
| `innovation-test` | icaro | gateway + `icaro-test-suite.mjs` |
| `politica-seguranca` | todos | policy |

---

## Cherry-pick futuro (P2+)

| Recurso | Skill/comando | Prioridade |
|---------|---------------|------------|
| wshobson | `/workflows:feature-dev` | média |
| Command Suite | `/test:generate-test-cases` | média (expandir Ícaro) |
| ruflo-cost-tracker | quotas Rimuru | baixa |
| npm audit CI | CVE read-only | baixa |

---

## Não adoptar

| Recurso | Motivo |
|---------|--------|
| Ruflo `init` completo | Conflita `.cursor/rules`, `.claude-flow/` |
| 216 commands Command Suite | Noise; 5–10 bastam |
| feiskyer LiteLLM/Copilot | Stack Cursor + Groq |
| Federation Ruflo | Gateway já faz broker |
| Auto-memory SONA | Risco PII; vault Obsidian |

---

## Paths skills por IDE

| IDE | Path projeto |
|-----|--------------|
| **Cursor** | `.cursor/skills/` |
| Claude Code | `.claude/skills/` |
| OpenClaw Jarvis | `skills/` + `gateway/skills/manifest.json` |

Fonte: [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills#skills-paths-for-other-ai-coding-assistants)

---

## Comandos úteis

```powershell
# Validar agentes (Ícaro)
node scripts/icaro-test-suite.mjs

# MCP local (dev com libs gateway)
$env:OPENCLAW_MCP_LOCAL="1"; node scripts/openclaw-mcp-server.mjs

# Catálogo MCP no gateway (após deploy)
curl -H "Authorization: Bearer $env:OPENCLAW_AUTOMATION_TOKEN" `
  https://agente-open-claw.vercel.app/openclaw/mcp/tools
```
