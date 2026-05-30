# HF Inference Router — fallback complexo (Telegram)

API OpenAI-compatible via [Inference Providers](https://huggingface.co/docs/inference-providers) da Hugging Face.

Relacionado: [HUGGINGFACE-SPACES.md](./HUGGINGFACE-SPACES.md) · [LEQUE-IAS.md](./LEQUE-IAS.md) · [OpenClaw HF provider](https://docs.openclaw.ai/providers/huggingface)

---

## Papel no stack

| Tier | Provider | Quando |
|------|----------|--------|
| Operacional | Gateway Vercel `/jarvis` | status, github, ajuda |
| Simples | Ollama `smollm2:360m` | oi, curto |
| Complexo 1 | DeepSeek API | analise, plano, codigo |
| Complexo 2 | **HF Router** | fallback se DeepSeek 402/erro |

OpenClaw tenta fallbacks em ordem: `deepseek/deepseek-v4-flash` -> `huggingface/Qwen/Qwen2.5-7B-Instruct:fastest`.

---

## Pre-requisitos

1. Token HF fine-grained com **Make calls to Inference Providers**
2. Activar provider (recomendado: **Groq**) em Settings -> Inference Providers
3. No `.env` (PC + EC2):

```env
HF_TOKEN=hf_...
HF_INFERENCE_MODEL=Qwen/Qwen2.5-7B-Instruct:fastest
```

---

## Testar

```powershell
cd scripts
node test-hf-inference.mjs
```

---

## Aplicar na EC2

```powershell
.\scripts\ec2-sync-env.ps1
ssh -i Chaves\OpenClaw.pem ubuntu@18.191.36.145
cd /opt/openclaw && git pull && sudo bash scripts/ec2-fix-telegram-models.sh
```

Scripts: `scripts/lib/hf-inference-config.mjs`, `scripts/ec2-tiered-llm-patch.mjs`.
