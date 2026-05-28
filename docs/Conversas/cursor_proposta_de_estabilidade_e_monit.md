# Proposta de estabilidade e monitoramento
_Exported on 27/05/2026 at 20:26:58 BRT from Cursor (3.2.16)_

---

**User**

primeiro analise a proposta e de sua opniao -> Aqui está o plano para garantir essa estabilidade:

1. Observabilidade: Você precisa de um "Painel de Controle" (Dashboard de Saúde)
Um agente não pode corrigir o que ele não consegue ver.

O Problema atual: Se um bot trava, você provavelmente só descobre quando o cliente reclama ou quando você tenta usar.

A Solução: Centralize os logs de todos os seus agentes e serviços em um único ponto (ex: Grafana + Prometheus ou Loki).

O que monitorar:

Uptime: Status HTTP dos seus serviços.

Latência: Tempo de resposta da API do Telegram e do Supabase.

Uso de Recursos: RAM/CPU da sua VPS. Se um agente começar a consumir 100% de CPU, o Supervisor precisa saber.

Erros de Aplicação: Erros críticos do Python (stack traces) devem ser enviados para um canal de "Log de Erros" no Telegram (não para o usuário final, mas para você/seu supervisor).

2. Infraestrutura Autocurativa (Self-Healing)
Como você está rodando tudo em Docker (o caminho correto), vamos implementar a Resiliência do Container:

Healthchecks: No seu docker-compose.yml, você deve definir healthcheck para cada serviço.

YAML
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
Restart Policy: Sempre use restart: unless-stopped. Se o contêiner falhar por causa de um erro de memória, ele reinicia sozinho.

Watchtower: Configure um contêiner do Watchtower. Ele monitora se você enviou uma nova imagem (um novo commit) para o GitHub/Docker Registry e faz o redeploy automático do seu bot, garantindo que o sistema esteja sempre atualizado sem você precisar logar no terminal.

3. Gerenciamento de Configuração e Segredos (Segurança)
Nunca deixe chaves de API (Telegram, Supabase, Gemini) fixas no código.

Realidade: Você precisa de um gerenciador de segredos. Se não quiser pagar, use arquivos .env gerenciados por um volume Docker, nunca versionados no Git.

Segurança: O seu Agente Supervisor deve ter permissão de leitura sobre esses arquivos, mas ele não deve ser capaz de imprimir esses segredos no log em caso de erro.

4. Backup e Disaster Recovery (Automação de Infra)
Se o seu VPS for deletado hoje, o quanto você demora para ter tudo rodando de novo?

O sonho não primitivo: Você tem um script de IaC (Infraestrutura como Código) — pode ser um script em Python usando a biblioteca Fabric ou Ansible.

A meta: Você executa um comando (./deploy-forge.sh) e ele:

Provisiona o servidor (ou limpa o existente).

Instala Docker e Docker Compose.

Clona o seu repositório agente_openclaw.

Cria as variáveis de ambiente a partir de um vault seguro.

Sobe todos os contêineres e verifica se a saúde está OK.

Por onde começar na Estabilidade?
Não vamos tentar implementar tudo isso de uma vez. Para começar a "acordar" seu servidor remoto:

Tarefa 1: Implementação de um "Heartbeat" de Infraestrutura.
Vamos criar um pequeno script em Python chamado heartbeat.py que verifica:

Se o banco de dados (Supabase) responde.

Se o bot do Telegram está online.

Se a VPS tem memória livre suficiente.

Se qualquer uma dessas falhar, o script envia um alerta direto para você no Telegram: [CRÍTICO] Falha no sistema X: [Motivo].

---

**Cursor**

Analisando o projeto OpenClaw para alinhar a opinião à infraestrutura real.


## Opinião geral

O plano está **correto na direção** (ver → recuperar → proteger → reconstruir). É o playbook clássico de SRE. O ponto fraco não é a teoria — é que **parte dele assume Docker + Supabase + stack de observabilidade completa**, enquanto o OpenClaw hoje está mais próximo de **EC2/VPS + systemd + `.env` + scripts PowerShell**.

Priorizar o **heartbeat** como Tarefa 1 é a decisão certa: alto retorno, baixo custo, e cobre o buraco mais doloroso (“só descubro quando alguém reclama”).

---

## O que encaixa bem no teu contexto atual

| Bloco do plano | Encaixa? | Nota |
|----------------|----------|------|
| Alertas no Telegram | Sim | Já tens `TELEGRAM_ADMIN_CHAT_ID`, `run-tests.ps1` e crons de skills — falta só **agendar** e **alertar em falha** |
| Healthcheck + restart | Sim, mas via **systemd** | `openclaw-gateway.service` já tem `Restart=on-failure`; podes evoluir para `Restart=always` + `ExecStartPre` / script de health |
| Segredos no `.env`, fora do Git | Sim | Já é a prática do repo; reforçar “nunca logar tokens” alinha com `POLITICA-SEGURANCA.md` |
| Script de deploy reproduzível | Parcial | Já existem `vps-deploy.ps1` e `vps-openclaw-setup.sh` — falta vault/backup, não recomeçar do zero |
| Grafana + Prometheus + Loki | Fase 2–3 | Útil, mas **pesado** numa VPS pequena; risco de o monitor consumir o que deves monitorar |
| Docker Compose + Watchtower | Só depois de migrar | Hoje **não há** `docker-compose` no repo; o deploy é Node + `systemctl` |

---

## Ajustes importantes por bloco

### 1. Observabilidade

A ideia é boa, mas eu **não começaria** com Grafana/Loki num único servidor.

**Fase pragmática:**

1. `heartbeat.py` (ou estender `run-tests.ps1`) a cada 5–15 min via **cron no VPS**
2. Canal separado de alertas (chat admin / tópico “ops”, não o chat do cliente)
3. Métricas mínimas: `systemctl is-active openclaw-gateway`, `curl` local em `:18789`, `getMe` do Telegram, latência MongoDB (Macofel), opcionalmente Vercel/GitHub se quiseres o mesmo pacote do `run-tests.ps1`

**Supabase:** no OpenClaw ainda é mais **futuro/opcional** do que dependência crítica. O heartbeat deve refletir **o que realmente quebra o negócio hoje**: gateway, Telegram, MongoDB (catálogo), e talvez os sites na Vercel — não um check genérico “Supabase” só porque está na proposta.

Grafana faz sentido quando tiveres **vários serviços** ou quiseres histórico de tendência (CPU a subir durante dias).

### 2. Self-healing

Conceito certo; **implementação atual = systemd**, não Docker.

- `Restart=on-failure` já existe no teu unit file
- Melhorias baratas: `Restart=always`, `WatchdogSec=`, timer que corre healthcheck e faz `systemctl restart` se falhar N vezes
- **Watchtower:** eu **adiaria** ou **não usaria** sem gate de aprovação — conflita com a política de “não alterar produção sem `sim`”. Auto-deploy de imagem nova às 3h pode derrubar o bot num commit mau.

### 3. Segredos

Totalmente alinhado. Um detalhe extra: o heartbeat e os logs devem usar **mensagens genéricas** (“Telegram: timeout”) e nunca imprimir URL com token ou corpo de erro que contenha `Authorization`.

### 4. Disaster recovery

O `./deploy-forge.sh` é o objetivo certo; **já tens ~60%** com deploy SSH + setup bash. O que falta de verdade:

- Backup do `.env` num sítio seguro (não no Git)
- Documentar “recriar EC2 em 30 min” (AMI snapshot ou script idempotente)
- Inventário: o que corre **na EC2** vs **Render** vs **Vercel** (Macofel Python na Render não volta só com o script do OpenClaw)

---

## Sobre a Tarefa 1 (heartbeat) — opinião direta

**Faz sentido e é o melhor primeiro passo**, com este desenho:

```
Cron (VPS) → heartbeat.py
  ├─ systemctl is-active openclaw-gateway
  ├─ HTTP GET localhost:18789 (ou endpoint health do gateway)
  ├─ Telegram getMe + opcional getUpdates recentes
  ├─ MongoDB ping (script que já usas no Macofel)
  ├─ RAM/disco (psutil ou /proc)
  └─ se falha → Telegram [CRÍTICO] + cooldown (evitar spam a cada minuto)
```

Reutiliza lógica de `run-tests.ps1` em Python ou bash no servidor — menos duplicação de regras.

**Cuidados:**

- **Anti-spam:** só alertar na transição OK→FALHA, ou no máximo 1 alerta por hora enquanto continuar em falha
- **Não depender do próprio bot** para enviar o alerta se o gateway estiver morto — usar `curl` direto à API do Telegram com o token (como já fazes nos testes)
- **Estado “degradado”** vs “crítico” (ex.: GitHub lento ≠ gateway down)

---

## Ordem que eu recomendaria (realista)

1. **Heartbeat + cron no VPS** (1–2 dias) — maior ganho imediato  
2. **Endurecer systemd** (health + restart) (meio dia)  
3. **Canal de erros** — redirecionar `journalctl` crítico ou hook simples (1 dia)  
4. **Backup `.env` + runbook** “EC2 morreu” (1 dia)  
5. **Uptime Kuma** ou similar, se quiseres UI sem operar Prometheus (opcional)  
6. **Grafana stack** — só se precisares de histórico e gráficos  
7. **Docker + Watchtower** — só se decidires migrar o gateway para containers  

---

## Veredito

| Aspeto | Nota |
|--------|------|
| Visão estratégica | 9/10 — madura e completa |
| Adequação ao stack atual | 6/10 — precisa adaptar Docker→systemd e Supabase→dependências reais |
| Priorização (heartbeat primeiro) | 10/10 — concordo plenamente |
| Risco de over-engineering | Médio se implementares tudo de uma vez |
| Conflito com política de segurança | Watchtower auto-deploy sem aprovação |

**Resumo:** aprovo o plano como **roadmap**, não como **sprint única**. Implementa já o heartbeat alinhado ao que tens (EC2, systemd, MongoDB, Telegram, gateway). Deixa Grafana/Docker/Watchtower para quando o básico estiver a acordar-te à noite só quando algo importante falhar.

Se quiseres o próximo passo no repo, posso esboçar o `scripts/heartbeat.py` + unit/timer systemd + exemplo de cron, reutilizando variáveis do `.env` sem expor secrets.

---

**User**

continue

---

**Cursor**

Implementando o heartbeat: analisando scripts e variáveis existentes para reutilizar o padrão do projeto.


Criando o heartbeat em Python (stdlib), units systemd e documentação.


O ficheiro `heartbeat.py` ficou corrompido (bytes nulos). Reescrevendo com encoding correto.


O Google Drive está a gravar ficheiros em UTF-16. Escrevendo via PowerShell com UTF-8 sem BOM.


Ajustando o check de disco (evitar falsos positivos no Google Drive no PC) e corrigindo ficheiros systemd corrompidos.


Implementei a **Tarefa 1 (heartbeat)**. Resumo do que ficou no repo e como activar no VPS.

## O que foi criado

| Ficheiro | Função |
|----------|--------|
| `scripts/heartbeat.py` | Checks + alertas Telegram (stdlib Python, sem pip) |
| `scripts/systemd/openclaw-heartbeat.{service,timer}` | Timer a cada **5 min** |
| `scripts/install-heartbeat-timer.sh` | Instalação no VPS |
| `docs/HEARTBEAT.md` | Guia |
| `docs/VPS-SETUP.md` | Secção heartbeat |
| `docs/CRON-EXEMPLOS.md` | Entrada cron/timer |
| `scripts/vps-openclaw-setup.sh` | Chama install do timer no fim do setup |
| `scripts/vps-console-install.sh` | Variáveis `OPENCLAW_GATEWAY_PORT`, `HEARTBEAT_ALERT_COOLDOWN_SEC` no template `.env` |

## Comportamento

- **Checks:** `gateway_service`, `gateway_http`, `telegram`, `mongodb`, `host_resources`
- **Alertas:** `[CRITICO]` em falha, `[RECUPERADO]` quando volta tudo OK
- **Anti-spam:** cooldown de 1 h (`HEARTBEAT_ALERT_COOLDOWN_SEC`)
- **Telegram:** API directa (funciona mesmo com gateway em baixo)
- **RAM/disco:** só em **Linux** (evita falso alarme no Google Drive no PC)

## Teste local (já corrido)

Com `HEARTBEAT_CHECK_GATEWAY=0`:

- Telegram: **OK** (`@LW_Acessor_bot`)
- MongoDB: falhou por `node_modules` corrompido no Drive (mesmo problema do `run-tests.ps1`)
- No VPS, depois de `npm install` em `scripts/`, o check Mongo deve funcionar

## Activar na EC2

1. Confirma no `.env` do servidor:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ADMIN_CHAT_ID` (teu chat privado)

2. Deploy (se ainda não enviaste os ficheiros novos):

```powershell
.\scripts\vps-deploy.ps1
```

3. No servidor:

```bash
sudo bash /opt/openclaw/scripts/install-heartbeat-timer.sh
OPENCLAW_ENV=/opt/openclaw/.env python3 /opt/openclaw/scripts/heartbeat.py --dry-run
sudo systemctl start openclaw-heartbeat.service
journalctl -u openclaw-heartbeat.service -n 20 --no-pager
```

4. No VPS, instala dependências Node para o check Mongo:

```bash
cd /opt/openclaw/scripts && npm install
```

---

**Nota técnica:** ficheiros no Google Drive estavam a gravar em UTF-16; reescrevi `heartbeat.py` e os units systemd via UTF-8 sem BOM. Se editares esses ficheiros no Cursor, confirma que o encoding é **UTF-8**.

Queres que no próximo passo endureça o `openclaw-gateway.service` (`Restart=always` + healthcheck) ou preferes primeiro validar os alertas na EC2?

