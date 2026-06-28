# Space HF — Openai-GBT-oss-20b (FastAPI)

Space: [Aldebaran-LW/Openai-GBT-oss-20b](https://huggingface.co/spaces/Aldebaran-LW/Openai-GBT-oss-20b)

Código local: `hf-space/openai-gpt-oss-20b/`

## Pré-requisitos

1. Token HF com **write**: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Space criado no Hub com SDK **Docker** (porta **7860**)
3. `HF_TOKEN` no `.env` da raiz OpenClaw (não commitar)

### Criar o Space (se ainda não existir)

No Hub: **New Space** → nome `Openai-GBT-oss-20b` → org `Aldebaran-LW` → SDK **Docker** → privado.

Ou com CLI (após `hf auth login`):

```powershell
hf repo create Aldebaran-LW/Openai-GBT-oss-20b --repo-type space --space-sdk docker
```

## Instalar CLI `hf` (Windows)

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://hf.co/cli/install.ps1 | iex"
hf auth login
hf auth whoami
```

## Opção A — Git (recomendado)

```powershell
cd $env:TEMP
git clone https://huggingface.co/spaces/Aldebaran-LW/Openai-GBT-oss-20b
cd Openai-GBT-oss-20b

# Copiar template do OpenClaw
$src = "H:\Meu Drive\Projetos\OpenClaw\hf-space\openai-gpt-oss-20b"
Copy-Item "$src\app.py", "$src\requirements.txt", "$src\Dockerfile", "$src\README.md", "$src\.gitignore" -Destination .

git add .
git commit -m "Add FastAPI application"
git push
```

No prompt de password do Git, usa o **token HF** (não a password da conta).

## Opção B — `hf download` + upload

```powershell
hf download Aldebaran-LW/Openai-GBT-oss-20b --repo-type=space --local-dir .\Openai-GBT-oss-20b
# Editar/copiar ficheiros em .\Openai-GBT-oss-20b
cd .\Openai-GBT-oss-20b
git add . ; git commit -m "Add application" ; git push
```

## Verificar

Após o build (~2–5 min):

- `https://aldebaran-lw-openai-gbt-oss-20b.hf.space/` → `{"Hello":"World!"}`
- `https://aldebaran-lw-openai-gbt-oss-20b.hf.space/health`
- `https://aldebaran-lw-openai-gbt-oss-20b.hf.space/docs` (Swagger)

(URL exacta aparece no painel do Space → **Embed this Space**.)

## Integração OpenClaw (futuro)

| Uso | Onde |
|-----|------|
| Inferência gpt-oss-20b free | OpenRouter `openai/gpt-oss-20b:free` — já em `friday-prod` |
| Endpoint dedicado | Este Space → URL em `HF_GPT_OSS_20B_URL` no `.env` |
| EC2 mínima | Não hospeda modelo; só chama HF/Vercel |

## Personalizar README

Edita o YAML no topo de `hf-space/openai-gpt-oss-20b/README.md` (`emoji`, `colorFrom`, `title`).

Documentação Docker Spaces: [Spaces SDK Docker](https://huggingface.co/docs/hub/spaces-sdks-docker)
