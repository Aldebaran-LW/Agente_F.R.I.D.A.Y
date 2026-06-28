export const RULES = [
  {
    agent: "rimuru",
    skill: "innovation-monitor",
    patterns: [/^\/quotas(?:@\w+)?$/i, /^quotas$/i, /^rimuru\s+status$/i],
  },
  {
    agent: "heimdall",
    skill: "ecosystem-watch",
    patterns: [/^\/office(?:@\w+)?$/i],
  },
  { agent: "macofel", skill: "macofel-status", patterns: [/macofel|catalogo|pendente|produto/i] },
  { agent: "macofel", skill: "macofel-images-sync", patterns: [/sync imagem|sync imagens|sincronizar imagem/i] },
  { agent: "heimdall", skill: "vercel-status", patterns: [/texte|portal.*deploy|deploy.*portal|deploy.*texte|ultimo deploy.*texte/i] },
  { agent: "heimdall", skill: "deploy-monitor", patterns: [/status portal|portal.*no ar|site.*portal|lwdigitalforge|digital.?forge.*portal/i] },
  { agent: "heimdall", skill: "github-aldebaran", patterns: [/github|repo|reposit|issue|commit|push|aldebaran|texte|lwdigitalforge/i] },
  { agent: "heimdall", skill: "vercel-status", patterns: [/vercel|deployment|deployments|ultimo deploy/i] },
  { agent: "heimdall", skill: "deploy-monitor", patterns: [/site.*no ar|sites no ar|health macofel|macofel.*no ar|online/i] },
  {
    agent: "heimdall",
    skill: "ecosystem-watch",
    patterns: [
      /heimdall\s+fluxo|fluxo\s+agentes|ecossistema|relatorio\s+agentes|observador/i,
      /situa(ç|c)(ã|a)o\s+(dos\s+)?agentes?|estado\s+(dos\s+)?agentes?|status\s+(dos\s+)?agentes?/i,
      /como\s+est(a|ã|ao)\s+(os\s+)?agentes?/i,
    ],
  },
  { agent: "vp-pecas", skill: "vp-pecas-health", patterns: [/vp-pecas|vp-precision|usinagem|nalva/i] },
  { agent: "sophia", skill: "innovation-knowledge", patterns: [/sophia|conhecimento|ferramentas? ia|pesquisa tecnica|tutorial|hf hub/i] },
  { agent: "yato", skill: "innovation-market", patterns: [/yato|mercado|concorren|marketing digital|product hunt|demanda/i] },
  { agent: "senku", skill: "innovation-analysis", patterns: [/senku|correlacion|analis(e|ar) dados|analysis/i] },
  { agent: "gideon", skill: "innovation-forecast", patterns: [/gideon|previs|antecip|cen[aá]rio|futuro|projec/i] },
  {
    agent: "rebeca",
    skill: "innovation-design",
    patterns: [
      /design|rebeca|brief visual|ui office|ui forge/i,
      /ferramentas?\s+(gratuit|design|3d|video|foto)/i,
      /hf\s*spaces?|testar\s+space/i,
      /rebeca\s+(pesquisar|relatorio|lista)/i,
    ],
  },
  {
    agent: "veldora",
    skill: "security-audit",
    patterns: [
      /seguranc|veldora|odin|auditoria|politica openclaw|relatorio seguranca/i,
      /verificar\s+fonte/i,
    ],
  },
  {
    agent: "rimuru",
    skill: "innovation-monitor",
    patterns: [
      /token|consumo|rimuru|athena|openrouter|quotas?|uso api/i,
      /rimuru\s+(status|alertar)/i,
    ],
  },
  { agent: "hefestos", skill: "innovation-build", patterns: [/hefestos|construir skill|implementar melhoria/i] },
  { agent: "icaro", skill: "innovation-test", patterns: [/icaro|testar agente|validar config|teste?\s+(os\s+)?agentes?|testar\s+(os\s+)?agentes?/i] },
  {
    agent: "jarvis",
    skill: "proposals-pipeline",
    patterns: [
      /^propostas$/i,
      /^\/propostas$/i,
      /^lista\s+propostas$/i,
      /^gerar\s+proposta\s+/i,
      /^aprovar\s+proposta\s+/i,
      /^rejeitar\s+proposta\s+/i,
    ],
  },
  {
    agent: "jarvis",
    skill: "user-preferences",
    patterns: [
      /^preferencia\s+listar$/i,
      /^\/preferencia$/i,
      /^preferencia\s+set\s+/i,
    ],
  },
  {
    agent: "jarvis",
    skill: "whatsapp-contacts",
    patterns: [
      /^contato\s+adicionar\s+/i,
      /^contato\s+listar$/i,
      /^contato\s+remover\s+/i,
      /^lista\s+contactos?$/i,
    ],
  },
  {
    agent: "jarvis",
    skill: "whatsapp-send-contact",
    patterns: [
      /^\/enviar\s+\w+\s+"/i,
      /^enviar\s+(?:para\s+)?\w+\s+"/i,
    ],
  },
  {
    agent: "jarvis",
    skill: "schedule-whatsapp",
    patterns: [
      /agendar\s+whatsapp/i,
      /lista\s+agendamentos?\s+whatsapp/i,
      /listar\s+agendamentos?\s+whatsapp/i,
      /meus\s+lembretes?\s+whatsapp/i,
      /cancelar\s+(?:agendamento\s+)?whatsapp/i,
    ],
  },
  { agent: "jarvis", skill: "help", patterns: [/^(ajuda|help|menu|comandos|agentes)$/i, /\boi\b|\bol[aá]\b|jarvis|quem e voce/i] },
];

export function routeMessage(message = "") {
  const text = String(message).trim();
  if (!text) return { agent: "jarvis", skill: "help", intent: "empty" };
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return { agent: rule.agent, skill: rule.skill, intent: text.slice(0, 120) };
    }
  }
  return { agent: "jarvis", skill: "clarify", intent: text.slice(0, 120) };
}

export function needsApproval(message = "") {
  return /sync|deploy|apagar|delete|push|merge|compra|pagamento/i.test(String(message));
}
