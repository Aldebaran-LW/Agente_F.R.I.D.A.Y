# Dev agents — Claude Code + Kilo Code (Docker)

Ambiente isolado para agentes de codigo, sem instalar no Windows.

## Requisitos

- Docker Desktop (WSL2)
- Chaves no `.env` na raiz OpenClaw:
  - `ANTHROPIC_API_KEY` (Claude Code)
  - `KILO_API_KEY` (Kilo Code — ja tens)

## Uso

```powershell
.\scripts\start-dev-agents-docker.ps1          # shell interactivo
.\scripts\claude-docker.ps1 --version          # Claude Code
.\scripts\kilo-docker.ps1 --help               # Kilo Code CLI
```

Dentro do container:

```bash
cd /workspace/OpenClaw
claude
kilo
```

## Volumes

| Volume | Conteudo |
|--------|----------|
| bind `Projetos` | `/workspace` |
| `openclaw_claude_config` | sessao Claude |
| `openclaw_kilo_config` | config Kilo |

Parar: `.\scripts\stop-dev-agents-docker.ps1`