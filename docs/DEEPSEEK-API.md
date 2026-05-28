# DeepSeek API (direta) - OpenClaw

API oficial compativel com OpenAI/Anthropic. Documentacao: https://api-docs.deepseek.com/

Relacionado: o mesmo V4 Flash tambem existe gratis via OpenRouter (deepseek/deepseek-v4-flash:free) - ver OPENROUTER-MODELOS-FREE.md.

---

## Dois caminhos para DeepSeek

| | API DeepSeek (direta) | OpenRouter |
|--|----------------------|------------|
| Chave | DEEPSEEK_API_KEY | OPENROUTER_API_KEY |
| Base URL | https://api.deepseek.com | https://openrouter.ai/api/v1 |
| V4 Flash | deepseek-v4-flash (pago na DeepSeek) | deepseek/deepseek-v4-flash:free |
| Quando usar | Conta DeepSeek, limites proprios | Varias chaves; tier :free |

---

## Configuracao

1. Conta: https://platform.deepseek.com
2. API keys: https://platform.deepseek.com/api_keys
3. No .env: DEEPSEEK_API_KEY=sk-...

| Parametro | Valor |
|-----------|--------|
| base_url (OpenAI SDK) | https://api.deepseek.com |
| Endpoint | POST https://api.deepseek.com/chat/completions |

### Modelos (2026)

| Modelo | Notas |
|--------|--------|
| deepseek-v4-flash | Rapido; thinking opcional |
| deepseek-v4-pro | Mais capaz |
| deepseek-chat | Deprecar 2026-07-24 = V4 Flash sem thinking |
| deepseek-reasoner | Deprecar 2026-07-24 = V4 Flash com thinking |

Thinking: "thinking": {"type": "enabled"}, "reasoning_effort": "high"

### OpenClaw

openclaw onboard -> provider OpenAI-compatible, base_url https://api.deepseek.com, modelo deepseek-v4-flash ou deepseek-v4-pro.

---

## Teste PowerShell

$headers = @{ Authorization = "Bearer $env:DEEPSEEK_API_KEY"; "Content-Type" = "application/json" }
$body = @{ model = "deepseek-v4-flash"; messages = @(@{ role = "user"; content = "OK em portugues?" }); stream = $false } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "https://api.deepseek.com/chat/completions" -Method POST -Headers $headers -Body $body

---

## Historico

| Data | Notas |
|------|--------|
| 2026-05-27 | Doc inicial |