# OpenClaw Cloudflare Workers

Nova arquitetura multi-worker substituindo o gateway Vercel + HF Spaces (que nunca rodaram).

## Estrutura

```
workers/
  deploy.sh           # Deploy todos os workers
  set-secrets.sh      # Configurar secrets
  shared/             # Libs compartilhadas (auth, response, telegram)
  router/             # Roteador principal — entrada única
  macofel/            # Catálogo Macofel (MongoDB + DeepSeek)
  jarvis/             # Orquestrador (Groq > DeepSeek > OpenRouter)
  heimdall/           # GitHub + Deploy + VP-Pecas
  innovation/         # Pipeline Sophia→Yato→Senku→Gideon
```

## Deploy

```bash
# Staging
bash workers/deploy.sh staging

# Production
bash workers/deploy.sh production

# Secrets (precisa das env vars exportadas)
bash workers/set-secrets.sh staging
```

## Rotas

| Rota | Worker | Descrição |
|------|--------|-----------|
| `/health` | router | Health check |
| `/jarvis` | jarvis | Orquestrador com LLM |
| `/macofel/status` | macofel | Status catálogo + MongoDB |
| `/macofel/images/sync` | macofel | Sync imagens |
| `/github/status` | heimdall | Status repos GitHub |
| `/deploy/health` | heimdall | Health deployments |
| `/vp-pecas/health` | heimdall | Sites VP-Pecas |
| `/innovation/status` | innovation | Pipeline inovação |

## CI/CD

GitHub Actions em `.github/workflows/deploy.yml` faz deploy automático de todos os 5 workers ao push na main.

## Chaves por Worker

| Worker | Chaves |
|--------|--------|
| jarvis | `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY` |
| macofel | `MONGODB_URI` |
| heimdall | `GITHUB_TOKEN`, `VERCEL_API_TOKEN` |
| innovation | `OPENROUTER_API_KEY` |
