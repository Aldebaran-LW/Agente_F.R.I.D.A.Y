# Dev agents — Claude Code + Kilo Code (Docker)

Ambiente isolado para agentes de codigo, sem instalar no Windows.

## Requisitos

- Docker Desktop (WSL2)
- Chaves no `.env` na raiz OpenClaw:
  - `ANTHROPIC_API_KEY` (Claude Code)
  - `KILO_API_KEY` (Kilo Code — ja tens)

## Uso

Preferir `.cmd` no Google Drive (evita encoding UTF-16 nos `.ps1`):

```cmd
scripts\start-dev-agents-docker.cmd
scripts\claude-docker.cmd --version
scripts\kilo-docker.cmd --help
```

Alternativa PowerShell (UTF-8 BOM):

```powershell
.\scripts\start-dev-agents-docker.ps1
.\scripts\claude-docker.ps1 --version
.\scripts\kilo-docker.ps1 --help
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