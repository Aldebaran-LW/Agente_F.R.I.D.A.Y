---
title: OpenAI GPT-OSS 20B
emoji: 🧠
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

API **FastAPI** no Hugging Face Space — base para expor o modelo [gpt-oss-20b](https://openrouter.ai/openai/gpt-oss-20b:free) (OpenRouter / HF Inference no futuro).

## Endpoints

| Rota | Resposta |
|------|----------|
| `/` | `{"Hello": "World!"}` |
| `/health` | `{"ok": true, ...}` |
| `/docs` | Swagger UI (FastAPI) |

## Deploy a partir do OpenClaw

Repo HF: **`Aldebaran-LW/Openai-GBT-oss-20b`** (nome no Hub).

```powershell
# 1) CLI HF (uma vez)
powershell -ExecutionPolicy ByPass -c "irm https://hf.co/cli/install.ps1 | iex"
hf auth login

# 2) Clone do Space (token com write)
git clone https://huggingface.co/spaces/Aldebaran-LW/Openai-GBT-oss-20b
cd Openai-GBT-oss-20b

# 3) Copiar ficheiros deste repo
Copy-Item -Recurse "H:\Meu Drive\Projetos\OpenClaw\hf-space\openai-gpt-oss-20b\*" .

git add requirements.txt app.py Dockerfile README.md .gitignore
git commit -m "Add FastAPI application"
git push
```

Ou: `hf download Aldebaran-LW/Openai-GBT-oss-20b --repo-type=space` e depois copiar os ficheiros.

Guia: `docs/HF-SPACE-GPT-OSS-20B.md`
