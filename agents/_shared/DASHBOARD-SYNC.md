# Sincronização com dashboards visuais

Regra partilhada por **todos os cérebros** (`orchestrator`, `macofel`, `vp-pecas`, `ops`).  
Copiar esta secção para o `SOUL.md` do workspace OpenClaw na EC2 (`~/.openclaw/workspace/SOUL.md`) ou referenciar este ficheiro.

Documentação completa: `docs/DASHBOARDS-VISUAIS.md`

---

## Regra de sincronização com o dashboard

- **Ao receber uma tarefa** (antes de tools/LLM pesado):
  ```bash
  python3 /opt/openclaw/Agente_OpenClaw/scripts/set_state.py <estado> "<descrição curta>" --agent <id>
  ```
- **Ao concluir com sucesso**:
  ```bash
  python3 /opt/openclaw/Agente_OpenClaw/scripts/set_state.py idle "Pronto para o próximo" --agent <id>
  ```
- **Em erro recuperável**:
  ```bash
  python3 /opt/openclaw/Agente_OpenClaw/scripts/set_state.py error "<resumo sem PII>" --agent <id>
  ```

Substituir `<id>` por: `orchestrator` | `macofel` | `vp-pecas` | `ops` (Jarvis = `orchestrator`).

**Nunca** incluir tokens, `.env`, dados pessoais do Lucas ou listagens de produtos na mensagem.

---

## Estados → zona do escritório (Star Office / pixel)

| Estado | O que o agente está a fazer | Zona típica |
|--------|-----------------------------|-------------|
| `idle` | À espera de instruções | Sofá / descanso |
| `writing` | Código ou documentação | Mesa programador |
| `researching` | Pesquisa / leitura de docs | Mesa de trabalho |
| `executing` | Comandos / scripts / deploy | Terminal |
| `syncing` | Sync dados / backup / API | Servidor / nuvem |
| `error` | Problema a resolver | Sala de bugs |

---

## Mapeamento por cérebro (sugestão)

| Cérebro | `--agent` | Estados frequentes |
|---------|-----------|-------------------|
| Orquestrador / Jarvis | `orchestrator` | `idle`, `thinking`, `executing` |
| Macofel | `macofel` | `researching`, `syncing`, `writing` |
| VP-Pecas | `vp-pecas` | `researching`, `executing` |
| Ops | `ops` | `executing`, `syncing`, `error` |

---

## Star Office UI

Se o Star Office estiver instalado na EC2:

```bash
export OPENCLAW_STAR_OFFICE_DIR=~/.openclaw/dashboards/Star-Office-UI
python3 set_state.py writing "Catálogo Macofel"
```

(porta **19000** — ver `docs/DASHBOARDS-VISUAIS.md`)

---

## Digital Forge (F.R.I.D.A.Y. — Three.js)

Quartel General minimal high-tech: `https://<gateway>/forge`

```bash
export OPENCLAW_FORGE_PUSH_URL=http://127.0.0.1:8787
python3 scripts/set_state.py compiling "api.ts" --agent ops   # → Byte no painel
```

Middleware na EC2: `node scripts/forge-ws-server.mjs` · Doc: `docs/DIGITAL-FORGE-FRIDAY.md`

---

## AgentMonitor / WebSocket

O [AgentMonitor](https://github.com/ruiqili2/agent-monitor) lê o gateway OpenClaw (`:18789`) — **não precisa** de `set_state.py` para funcionar; o script acima complementa painéis baseados em ficheiro ou o nosso `/office` na Vercel.
