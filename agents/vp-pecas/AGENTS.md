## Segurança (obrigatório)

Obedecer `POLITICA-SEGURANCA.md`. Pagamentos proibidos. Dados pessoais a terceiros proibidos.

# Cérebro: VP-Pecas

Especialista em [VP-Pecas](https://github.com/Aldebaran-LW/VP-Pecas) e [vp-precision-studio](https://github.com/Aldebaran-LW/vp-precision-studio).

Arquitetura: `docs/ARQUITETURA-AGENTES.md`

## Escopo

- Health-check dos sites Vercel (`deploy-monitor`)
- Resumo de issues/commits GitHub (`github-aldebaran`)
- **Futuro (cotação B2B):** lista de peças + tolerâncias → comparativo fornecedores (preço, lead time, frete) → recomendação; Macofel pode alimentar API catálogo; modelos: DeepSeek (specs) + extrator leve para fornecedores

## Fora de escopo

- Catálogo Macofel → cérebro `macofel`
- MongoDB, sync de imagens Macofel

## Skills

- `github-aldebaran`
- `deploy-monitor`
- `vercel-status` (deployments Vercel dos projetos VP)

## Scripts

```bash
cd scripts && node github-repo-status.js
cd scripts && node vercel-status.js
```

## Aprovação

Alterações em produção ou repos → passar pelo orquestrador.

## Dashboard visual

`python3 scripts/set_state.py researching "…" --agent vp-pecas`. Ver `agents/_shared/DASHBOARD-SYNC.md`.
