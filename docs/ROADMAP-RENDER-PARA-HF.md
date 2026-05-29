# Roadmap: Render -> Hugging Face + multi-agente

## O que NAO migrar para HF

| Servico Render | Motivo |
|----------------|--------|
| **Agente catalogo Macofel (Python)** | Long-running, Mongo, logica de negocio — manter Render ou Vercel API Macofel |
| **Telegram / OpenClaw** | EC2 (processo continuo) |
| **Secrets Macofel/Mongo** | Vercel gateway |

## O que pode ir para HF (custo ~0)

| Funcao | HF | Repo local |
|--------|-----|------------|
| Demo publica / health | Space `openclaw-demo` | `hf-space/demo/` |
| Backup snapshots + aprendizagens | Dataset `openclaw-backup` | `hf-backup-upload.mjs`, `hf-ingest-learning.mjs` |
| Prototipo API leve | Novo Space Docker por funcao | `hf-space/` |
| Modelos / datasets comunidade | Leitura via HF_TOKEN | agentes registam com `hf-ingest-learning.mjs` |

## Portfólio G:\Meu Drive\Projetos

OpenClaw **orquestra** projetos no Drive e GitHub; nao substitui cada app.

```
Projetos/
  OpenClaw/          <- este repo (agentes, gateway, scripts)
  Macofel_2.0/       <- Vercel + Render catálogo
  VP-Pecas/          <- Vercel
```

Novos agentes: `node scripts/scaffold-agent.mjs` — ficam em `agents/<id>/`.

## Fases

### Fase A (feito)
- Space demo + Dataset backup
- config.yaml por cerebro

### Fase B (agora)
- `sync-agent-config-to-openclaw.mjs` na EC2
- Dominio custom Vercel (`docs/DOMINIO-VERCEL.md`)

### Fase C (futuro)
- Space HF por agente **so se** precisares UI isolada (nao obrigatorio)
- Cron EC2: backup diario + resumo learnings
- Nao duplicar Render Python no HF sem reescrever servico

## Politica

`POLITICA-SEGURANCA.md` — producao Macofel/deploy continua com aprovacao Telegram.