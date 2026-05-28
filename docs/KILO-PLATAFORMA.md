# Kilo (kilo.ai) — relacao com OpenClaw Aldebaran

Documentacao oficial: https://kilo.ai/docs/

A Kilo e uma **plataforma** com tres pecas. O teu projeto **Agente_OpenClaw** e self-hosted; a Kilo oferece sobretudo **hosted** e **IDE**.

---

## Tres produtos Kilo

| Produto | O que e | Relacao com o teu OpenClaw |
|---------|---------|----------------------------|
| **Kilo Code** | Extensao VS Code / JetBrains + CLI — agente de codigo no editor | **Paralelo ao Cursor** — ferramenta de dev do Lucas, nao substitui Jarvis/Telegram |
| **KiloClaw** | OpenClaw **alojado** (chat, triggers, integracoes sem self-host) | **Alternativa** ao teu fluxo EC2 + `openclaw onboard` + gateway Vercel — tu escolheste self-host em `docs/BASICO-OPENCLAW.md` |
| **Kilo Gateway** | API unica para 500+ modelos (streaming, BYOK, usage) | **Paralelo** a OpenRouter / Infron / DeepSeek — outro gateway LLM se quiseres uma so fatura |

---

## O que podes fazer (pratico)

### Se continuas self-hosted (recomendado no teu repo)

- **Nao precisas** de KiloClaw para o Jarvis funcionar.
- Mantem: `.env` + `%USERPROFILE%\.openclaw\` + gateway Vercel (`docs/GATEWAY-VERCEL.md`).
- LLM: `OPENROUTER_API_KEY` (free), ou `DEEPSEEK_API_KEY`, ou `INFRON_API_KEY` — ver docs respectivos.

### Se quiseres experimentar Kilo

| Objetivo | Acao |
|----------|------|
| Codar com agente no VS Code | Instalar [Kilo Code](https://kilo.ai/docs/) (`kilocode.kilo-code` ou `@kilocode/cli`) |
| Evitar gerir servidor OpenClaw | Avaliar **KiloClaw** (hosted) — migra ops, perdes controlo total na EC2 |
| Um endpoint para muitos modelos | Avaliar **Kilo Gateway** vs OpenRouter que ja documentaste |

### BYOK (Bring Your Own Key)

Kilo Gateway permite usar **as tuas** chaves (OpenRouter, OpenAI, etc.) num unico painel. Util se quiseres dashboard de uso; **nao obrigatorio** se ja tens chaves no `.env`.

---

## Comparacao: teu Jarvis vs KiloClaw

| | **Teu OpenClaw (Aldebaran)** | **KiloClaw (hosted)** |
|--|------------------------------|------------------------|
| Controlo | EC2, Vercel, `.env` teu | Kilo gere infra |
| Politica / aprovacao | `POLITICA-SEGURANCA.md`, Telegram `sim` | Configurar nas regras Kilo |
| Cerebros multi-agente | `agents/orchestrator`, macofel, ops | Depende do produto Kilo |
| Custo | VPS + APIs que escolheres | Subscricao Kilo + APIs |

---

## Links uteis (doc Kilo)

- [Get Started / Installation](https://kilo.ai/docs/)
- Kilo Code: chat, modes, custom rules
- KiloClaw: overview, chat platforms, dev tools
- Kilo Gateway: modelos unificados

---

## Historico

| Data | Notas |
|------|--------|
| 2026-05-27 | Visao geral — Kilo vs stack self-hosted Aldebaran |