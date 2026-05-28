# OpenRouter — modelos free e uso no OpenClaw

Referência consolidada dos modelos **gratuitos** na [OpenRouter](https://openrouter.ai) para o workspace Aldebaran-LW / Jarvis.

**Uma chave, muitos modelos:** `OPENROUTER_API_KEY` no `.env` (ver [VARIAVEIS-AMBIENTE.md](./VARIAVEIS-AMBIENTE.md)).

---

## O que podes fazer com isto

| Uso | Como |
|-----|------|
| **Telegram / Jarvis** | `openclaw onboard` → provider OpenRouter → ID do modelo (primary + fallbacks) |
| **Testar modelos** | Script PowerShell na secção [Teste rápido](#teste-rápido) |
| **Economizar tokens** | Ordem do orquestrador: scripts/cron → Ollama (EC2) → **só depois** OpenRouter free |
| **Por cérebro** | `ops`/código → Laguna ou MiniMax; contexto longo → Nemotron / DeepSeek / Owl |
| **Fallback** | OpenRouter escolhe provider; configurar vários modelos no OpenClaw |
| **Sem custo API** | IDs com `:free` ou marcados Free na OpenRouter |

**Não substitui:**

- `GOOGLE_API_KEY` — API direta Gemini.
- `OPENAI_API_KEY` — modelos comerciais OpenAI (GPT-4o, etc.).
- Scripts (`macofel-count-pending.js`, `github-repo-status.js`) — **zero LLM**.

**Política:** `POLITICA-SEGURANCA.md` — não enviar secrets, PII ou dados de clientes nos prompts. **Owl Alpha** pode registar conversas para melhorar o modelo.

---

## Configuração mínima

### 1. Chave

1. Conta em [openrouter.ai](https://openrouter.ai)
2. [API Keys](https://openrouter.ai/keys) → `sk-or-v1-...`
3. No `.env` da raiz:

```env
OPENROUTER_API_KEY=sk-or-v1-...
```

### 2. Sessão PowerShell (opcional)

```powershell
$env:OPENROUTER_API_KEY = "sk-or-v1-..."
```

### 3. OpenClaw (Telegram / gateway)

- Windows: `%USERPROFILE%\.openclaw\`
- Mesma chave que no `.env`
- Wizard: provider **OpenRouter** / `openrouter-api-key`
- Modelo default + fallbacks (IDs abaixo)

### 4. Ordem de custo (orquestrador)

`agents/orchestrator/AGENTS.md`:

1. Scripts e APIs (sem LLM)
2. Ollama local (EC2)
3. Gemini ou **OpenRouter free**
4. Modelos **pagos** — só com pedido explícito do Lucas

---

## Catálogo de modelos (free)

| Nome | ID na API | Contexto | Destaque | Página |
|------|-----------|----------|----------|--------|
| **Owl Alpha** | `openrouter/owl-alpha` | 1M | Agentes, compatível OpenClaw; prompts podem ser logados | [link](https://openrouter.ai/openrouter/owl-alpha) |
| **Nemotron 3 Super** | `nvidia/nemotron-3-super-120b-a12b:free` | 1M | Multi-agente, raciocínio longo | [link](https://openrouter.ai/nvidia/nemotron-3-super-120b-a12b:free) |
| **DeepSeek V4 Flash** | `deepseek/deepseek-v4-flash:free` | 1M | Rápido, reasoning high/xhigh | [link](https://openrouter.ai/deepseek/deepseek-v4-flash:free/api) |
| **Laguna M.1** | `poolside/laguna-m.1:free` | 262K | Código flagship (Poolside) | [link](https://openrouter.ai/poolside/laguna-m.1:free) |
| **Laguna XS.2** | `poolside/laguna-xs.2:free` | 262K | Código compacto / rápido | [link](https://openrouter.ai/poolside/laguna-xs.2:free) |
| **MiniMax M2.5** | `minimax/minimax-m2.5:free` | 262K | Código + office / agentes | [link](https://openrouter.ai/minimax/minimax-m2.5:free) |
| **Gemma 4 26B** | `google/gemma-4-26b-a4b-it:free` | 262K | Multimodal, tools, Google | [link](https://openrouter.ai/google/gemma-4-26b-a4b-it:free) |
| **gpt-oss-120b** | `openai/gpt-oss-120b:free` | 131K | Geral forte, agentic | [link](https://openrouter.ai/openai/gpt-oss-120b:free) |
| **gpt-oss-20b** | `openai/gpt-oss-20b:free` | 131K | Geral leve, rápido | [link](https://openrouter.ai/openai/gpt-oss-20b:free) |
| **GLM 4.5 Air** | `z-ai/glm-4.5-air:free` | 131K | Agentes; `reasoning.enabled` on/off | [link](https://openrouter.ai/z-ai/glm-4.5-air:free) |

Endpoint: `POST https://openrouter.ai/api/v1/chat/completions`

---

## Stacks recomendadas (OpenClaw / Jarvis)

### A — Agentes (Telegram)

| Papel | Modelo |
|-------|--------|
| Primary | `openrouter/owl-alpha` |
| Código / ops | `poolside/laguna-m.1:free` |
| Fallback 1M | `nvidia/nemotron-3-super-120b-a12b:free` |
| Rápido | `openai/gpt-oss-20b:free` |

### B — Máximo contexto (sem Owl)

| Papel | Modelo |
|-------|--------|
| Primary | `nvidia/nemotron-3-super-120b-a12b:free` |
| Fallback 1M | `deepseek/deepseek-v4-flash:free` |
| Código | `poolside/laguna-m.1:free` |
| Rápido | `openai/gpt-oss-20b:free` |

### C — Só código (cérebro ops)

| Papel | Modelo |
|-------|--------|
| Primary | `poolside/laguna-m.1:free` |
| Rápido | `poolside/laguna-xs.2:free` |
| Geral | `openai/gpt-oss-120b:free` |

### D — Mínimo (teste)

| Papel | Modelo |
|-------|--------|
| Primary | `openai/gpt-oss-20b:free` |
| Fallback | `z-ai/glm-4.5-air:free` |

---

## Mapeamento cérebro → modelo

| Cérebro | Tarefa típica | Modelo sugerido |
|---------|---------------|-----------------|
| `orchestrator` (Jarvis) | Coordenação, PT curto | Stack **A** |
| `ops` | GitHub, deploy, Vercel | `poolside/laguna-m.1:free` |
| `macofel` | Preferir scripts + gateway | `google/gemma-4-26b-a4b-it:free` se multimodal |
| `vp-pecas` | Issues, deploy | `minimax/minimax-m2.5:free` ou Laguna XS |

Alertas (`macofel-status`, `github-aldebaran`, cron): **não usar LLM** — `scripts/`.

---

## Teste rápido

```powershell
$model = "openrouter/owl-alpha"

$headers = @{
  Authorization = "Bearer $env:OPENROUTER_API_KEY"
  "Content-Type" = "application/json"
}
$body = @{
  model = $model
  messages = @(@{ role = "user"; content = "Responde em português: OK?" })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "https://openrouter.ai/api/v1/chat/completions" -Method POST -Headers $headers -Body $body
```

**GLM 4.5 Air:** no JSON do body, `"reasoning": { "enabled": true }`.

---

## Privacidade e limites free

- Nunca no prompt: tokens, `.env`, passwords, PII.
- **Owl Alpha:** conversas podem ser usadas para treino.
- Tier free: filas, rate limits; ter fallbacks na config.
- Modelos `:free` podem mudar — rever esta página periodicamente.

---

## Comandos úteis

```powershell
cd "G:\Meu Drive\Projetos\OpenClaw"
openclaw doctor
.\sync-workspaces.ps1
```

---

## Histórico

| Data | Notas |
|------|--------|
| 2026-05-27 | Catálogo inicial dos modelos free para Jarvis/OpenClaw |
