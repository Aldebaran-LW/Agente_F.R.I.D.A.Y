# Infron API (OneRouter) - OpenClaw

Gateway LLM compativel com **OpenAI Chat Completions**. Quickstart: https://infron.ai/docs/overview/quickstart/text

Formato de modelos igual ao OpenRouter (`fornecedor/modelo`), mas **outra chave e outro endpoint**.

---

## Comparacao rapida

| | **Infron** | **OpenRouter** | **DeepSeek direto** |
|--|------------|----------------|---------------------|
| Chave | `INFRON_API_KEY` | `OPENROUTER_API_KEY` | `DEEPSEEK_API_KEY` |
| Base URL | `https://llm.onerouter.pro/v1` | `https://openrouter.ai/api/v1` | `https://api.deepseek.com` |
| Exemplo modelo | `deepseek/deepseek-v3.2` | `deepseek/deepseek-v4-flash:free` | `deepseek-v4-flash` |

Ver tambem: [OPENROUTER-MODELOS-FREE.md](./OPENROUTER-MODELOS-FREE.md), [DEEPSEEK-API.md](./DEEPSEEK-API.md).

---

## Configuracao

1. Conta / API key em [infron.ai](https://infron.ai)
2. No `.env`:

```env
INFRON_API_KEY=
INFRON_BASE_URL=https://llm.onerouter.pro/v1
```

(`INFRON_BASE_URL` e opcional se usares sempre o default.)

3. **OpenClaw** (`openclaw onboard` ou `%USERPROFILE%\.openclaw\`):
   - Provider: OpenAI-compatible
   - `base_url` = `https://llm.onerouter.pro/v1`
   - API key = `INFRON_API_KEY`
   - Modelo = ex. `deepseek/deepseek-v3.2` (lista no painel Infron)

Ordem do orquestrador: scripts/cron -> Ollama -> LLM free/barato -> pagos so com pedido explicito.

---

## Teste PowerShell

```powershell
$headers = @{
  Authorization = "Bearer $env:INFRON_API_KEY"
  "Content-Type" = "application/json"
}
$body = @{
  model = "deepseek/deepseek-v3.2"
  messages = @(@{ role = "user"; content = "Responde em portugues: OK?" })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "https://llm.onerouter.pro/v1/chat/completions" -Method POST -Headers $headers -Body $body
```

Streaming: `"stream": true` no body (ver doc Infron).

---

## OpenAI SDK (Node/Python)

```python
from openai import OpenAI
client = OpenAI(base_url="https://llm.onerouter.pro/v1", api_key=os.environ["INFRON_API_KEY"])
```

---

## Privacidade

Seguir `POLITICA-SEGURANCA.md` — nao enviar secrets ou PII nos prompts.

---

## Historico

| Data | Notas |
|------|--------|
| 2026-05-27 | Doc inicial — quickstart Infron / OneRouter |