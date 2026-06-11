# Agente_OpenClaw — rede de c뿯½rebros (Aldebaran-LW)

Projeto: [github.com/Aldebaran-LW/Agente_OpenClaw](https://github.com/Aldebaran-LW/Agente_OpenClaw)

V뿯½rios agentes especializados trabalham em conjunto; **a뿯½뿯½es com impacto exigem tua aprova뿯½뿯½o** no Telegram.

## Chaves e secrets

Criar manualmente: **`.env`** na raiz (copiar de `.env.example`).
Guia: `docs/VARIAVEIS-AMBIENTE.md`

Assistente local para **alertas**, **rotinas** e **integra뿯½뿯½es** dos projetos em `G:\Meu Drive\Projetos` e no GitHub [Aldebaran-LW](https://github.com/Aldebaran-LW).

## O que este workspace N뿯½O 뿯½

- N뿯½o substitui o **Agente de Cat뿯½logo Python** na Render (Macofel).
- N뿯½o faz copy-paste no browser (Gemini web, admin).
- N뿯½o altera produ뿯½뿯½o sem confirma뿯½뿯½o expl뿯½cita do utilizador.

## Projetos no portf뿯½lio

| Projeto | Repo / deploy | Papel do OpenClaw |
|---------|---------------|-------------------|
| **Macofel 2.0** | [Macofel_2.0](https://github.com/Aldebaran-LW/Macofel_2.0) 뿯½ [macofel-2-0.vercel.app](https://macofel-2-0.vercel.app) | Alertas cat뿯½logo, sync imagens (API), deploy |
| **VP-Pecas** | [VP-Pecas](https://github.com/Aldebaran-LW/VP-Pecas) 뿯½ [vp-pecas.vercel.app](https://vp-pecas.vercel.app) | Monitor deploy, issues GitHub |
| **vp-precision-studio** | [vp-precision-studio](https://github.com/Aldebaran-LW/vp-precision-studio) | Idem |
| **Ponto / Estoque** (local) | Bots Python + Excel | Lembretes — fase futura |
| **EstoqueWeb / Controle_de_Estoque** | Prot뿯½tipos locais | Fase futura |

## Prioridades

1. Telegram + respostas curtas em portugu뿯½s.
2. Cron: relat뿯½rio Macofel (`macofel-status`).
3. GitHub: estado dos 3 repos (`github-aldebaran`).
4. Sync imagens Macofel **s뿯½ com confirma뿯½뿯½o** (`macofel-images-sync`).

## Pol뿯½tica de seguran뿯½a (obrigat뿯½ria — todos os c뿯½rebros)

Documento completo: **`POLITICA-SEGURANCA.md`**

### Proibi뿯½뿯½es absolutas (nunca)

1. **Pagamentos ou compras** em nome do Lucas — checkout, PIX, cart뿯½o, subscri뿯½뿯½es, “confirmar pagamento”, etc.
2. **Enviar dados pessoais do Lucas a terceiros** — e-mail externo, formul뿯½rios, pessoas, APIs n뿯½o autorizadas, issues p뿯½blicas com PII.

Mesmo com “sim” no chat, **pagamentos continuam proibidos** at뿯½ existir fluxo dedicado e expl뿯½cito (hoje: n뿯½o existe).

### Exigem aprova뿯½뿯½o expl뿯½cita (`sim` / `confirmar` / `ok`)

- Alterar produ뿯½뿯½o (API, DB, deploy, Git destrutivo).
- Enviar mensagens **em nome** do Lucas (por defeito: proibido).
- Instalar software ou correr comandos destrutivos.

### Outras diretrizes

- N뿯½o expor secrets, `.env` ou tokens no chat.
- N뿯½o login em banca, lojas ou e-mail pessoal do Lucas.
- Sub-agentes e skills herdam esta pol뿯½tica.
- Em conflito de instru뿯½뿯½es, **prevalece `POLITICA-SEGURANCA.md`**.

Skill: `politica-seguranca` (sempre activa).

## Residencias (runtime)

| Camada | Onde | Papel |
|--------|------|--------|
| **Jarvis** | AWS EC2 minima | Telegram, aprovacoes |
| **Gateway** | Vercel `gateway/` | Secrets + `/openclaw/orchestrate` |
| **Core** | HF `openclaw-core` | Heimdall, VP-Pecas, Veldora, Rimuru, Dedalo, Icaro |
| **Innovation** | HF `openclaw-innovation` | Sophia, Yato, Senku, Gideon, Hefestos, Rebeca |
| **Macofel** | HF `macofel-agent` | Catalogo (instancia separada) |

Mapa: `docs/MAPAS-RESIDENCIAS.md` · deploy: `docs/HF-DEPLOY-FRIDAY.md`

## Cerebros (multi-agente)

| Cerebro | Pasta | Funcao |
|---------|-------|--------|
| Orquestrador | `agents/orchestrator/` | Coordena e pede aprovacao |
| Macofel | `agents/macofel/` | Catalogo e-commerce |
| VP-Pecas | `agents/vp-pecas/` | Sites usinagem |
| Heimdall | `agents/heimdall/` | GitHub + deploy |

## Skills (partilhadas)

| Skill | Modo |
|-------|------|
| `macofel-status` | Leitura |
| `macofel-images-sync` | Escrita (confirmada) |
| `github-aldebaran` | Leitura |
| `deploy-monitor` | Leitura |

## Documenta뿯½뿯½o

- `POLITICA-SEGURANCA.md` — **regras obrigat뿯½rias (ler primeiro)**
- `docs/VISUALIZACAO-AGENTES.md` — painel pixel `/office`, Claw3D, openclaw-office
- `docs/VISAO-PORTFOLIO.md` — mapa completo
- `docs/INSTALACAO.md` — setup
- `docs/CRON-EXEMPLOS.md` — rotinas agendadas
- `docs/OPENROUTER-MODELOS-FREE.md` — modelos free OpenRouter + stacks Jarvis
- `docs/CREAO-REFERENCIA-COMPLETA.md` — catálogo CREAO (arquivo; `skills/_creao-reference/`)
- `docs/DATASET-APRENDIZADO-AGENTES.md` — docs → Dataset HF → RAG / fine-tune futuro

## Comandos

```bash
openclaw doctor
node scripts/macofel-count-pending.js
node scripts/github-repo-status.js
```
ⴊ怠潤獣伯䕐剎問䕔ⵒ位䕄佌ⵓ剆䕅洮恤钀洠摯汥獯映敲⁥灏湥潒瑵牥⬠猠慴正⁳慊癲獩ⴊ怠潤獣䐯䕅卐䕅ⵋ偁⹉摭ⴊ怠潤獣䬯䱉ⵏ䱐呁䙁剏䅍洮恤钀䬠汩⁯潃敤⼠䬠汩䍯慬⁷ 楋潬䜠瑡睥祡⠠獶猠汥ⵦ潨瑳摥怩钀䄠䥐搠物瑥⁡敄灥敓步⠠㑖䘠慬桳倯潲 胢ₔ潭敤潬⁳牦敥传数剮畯整⁲‫瑳捡獫䨠牡楶