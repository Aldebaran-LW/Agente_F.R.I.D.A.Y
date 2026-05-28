# Digital Forge — Quartel General F.R.I.D.A.Y.

Ambiente visual **minimal high-tech** (branco, cinza claro, azul cobalto) para o domínio **f.r.i.d.a.y.lwdigitalforge.com**.  
Prova de conceito em **Three.js** com bloom; evolução futura: React Three Fiber ou Unreal Pixel Streaming.

Relacionado: [DASHBOARDS-VISUAIS.md](./DASHBOARDS-VISUAIS.md) · [VISUALIZACAO-AGENTES.md](./VISUALIZACAO-AGENTES.md)

---

## 1. Ambientação e arquitetura

| Elemento | Implementação POC |
|----------|-------------------|
| Cores / luz | Fundo `#f4f7fb`, luz direcional “dia”, chão metalness alto |
| Layout | Mesas holográficas (vidro + bordas emissivas), sem estações pesadas |
| Coração do Reator | Esfera central + anel + bloom (`UnrealBloomPass`) |
| Portal de Análise | Anel no chão + label (lado esquerdo) |
| Núcleo de Criação | Label (lado direito) |
| Feixe de dados | Linha agente → reator quando `state` ativo |

**Não** é cyberpunk escuro: sem chamas; emissão azul cobalto e partículas discretas.

---

## 2. Personas ↔ cérebros OpenClaw

| Persona | Papel | Cérebro OpenClaw | Estação |
|---------|-------|------------------|---------|
| **F.R.I.D.A.Y.** | Orquestrador | `orchestrator` | Núcleo |
| **Byte** | Code | `ops` | Teclado holográfico (verde no HUD) |
| **Pixel** | Design | `vp-pecas` | Mesa de luz 3D |
| **Lala** | QA | `macofel` | “Microscópio quântico” |

---

## 3. Estados visuais

| `state` (JSON / set_state) | Visual |
|----------------------------|--------|
| `idle` | Agente parado, anel apagado |
| `writing` / `compiling` | Anel girando + feixe ao reator |
| `researching` / `executing` / `syncing` | Idem |
| `thinking` | Emissão suave |
| `error` | (futuro) pulso vermelho suave |

Corpos: cápsulas claras + visor escuro (ícone FRIDAY pode ser textura futura).

---

## 4. Stack técnica

| Camada | Ficheiro | Onde corre |
|--------|----------|------------|
| **Painel 3D** | `gateway/public/forge/` | Vercel `/forge` (estático) |
| **Middleware** | `scripts/forge-ws-server.mjs` | EC2 `:8787` (HTTP push + SSE) |
| **Push CLI** | `scripts/forge-push.mjs` | PC / EC2 |
| **Bridge Python** | `scripts/set_state.py` | Se `OPENCLAW_FORGE_PUSH_URL` |

### HTTP / SSE (sem dependências extra)

```json
{
  "agent": "byte",
  "state": "compiling",
  "task": "api.ts",
  "file": "gateway/lib/office.mjs"
}
```

- `POST http://127.0.0.1:8787/push` — agentes Python/shell
- `GET http://127.0.0.1:8787/events` — SSE para o painel Three.js
- `GET /snapshot` — fallback polling

### Three.js vs Unreal

| | Three.js (atual) | Unreal 5 + Pixel Streaming |
|--|------------------|----------------------------|
| Deploy | Vercel + EC2 leve | GPU dedicada no servidor |
| Qualidade | Boa com bloom | Cinematográfica (Lumen/Nanite) |
| Custo | Baixo | Alto |
| Próximo passo | Migrar para **R3F** no repo `digital-forge/` | Só se precisares filme |

Assets: Sketchfab “Sci-Fi lab interior” (`.glb`), texturas clean futuristic.

---

## 5. Passo a passo

### A. EC2 — middleware

```bash
cd ~/Agente_OpenClaw/scripts
npm install
export OPENCLAW_FORGE_PUSH_URL=http://127.0.0.1:8787
node forge-ws-server.mjs
# ou: npm run forge
```

Persistir com systemd (opcional): ver `scripts/setup-forge-ec2.sh`.

### B. PC — túnel + browser

```powershell
.\scripts\forge-tunnel.ps1
# Browser: http://127.0.0.1:8787 não — abrir forge na Vercel:
.\scripts\forge-open.ps1
# No painel: ws://127.0.0.1:8787 → Ligar
```

### C. Agente reporta estado

```bash
export OPENCLAW_FORGE_PUSH_URL=http://127.0.0.1:8787
python3 scripts/set_state.py compiling "api.ts" --agent ops
# → push para persona "byte"
```

Regras SOUL: `agents/_shared/DASHBOARD-SYNC.md` (secção Digital Forge).

### D. Vercel — painel estático

Após deploy do `gateway/`:

`https://<gateway>/forge?ws=ws://127.0.0.1:8787` (com túnel)  
ou domínio custom **f.r.i.d.a.y.lwdigitalforge.com** → mesmo projeto Vercel, rewrite `/forge`.

---

## 6. Domínio f.r.i.d.a.y.lwdigitalforge.com

1. Vercel → projeto gateway → Domains → adicionar subdomínio.
2. DNS CNAME para `cname.vercel-dns.com`.
3. **Não** expor `:8787` na internet; WS só via túnel SSH ou proxy autenticado.
4. `/forge` é público (HTML); dados sensíveis só via WS local/túnel.

---

## 7. Roadmap

- [ ] Texturas e `.glb` interior “clean lab”
- [ ] Ícone FRIDAY no visor (sprite/canvas)
- [ ] Feixes world-space precisos agente → reator
- [ ] Pacote R3F com `@react-three/fiber` + `@react-three/drei`
- [ ] Sync automático desde `GET /openclaw/office/status`
- [ ] Unreal POC (opcional)

---

## Ficheiros

| Path | Função |
|------|--------|
| `gateway/public/forge/*` | POC Three.js + bloom |
| `scripts/forge-ws-server.mjs` | Middleware |
| `scripts/forge-push.mjs` | CLI push |
| `scripts/forge-tunnel.ps1` | SSH :8787 |
| `scripts/setup-forge-ec2.sh` | Setup EC2 |
| `scripts/forge-open.ps1` | Abre `/forge` |
