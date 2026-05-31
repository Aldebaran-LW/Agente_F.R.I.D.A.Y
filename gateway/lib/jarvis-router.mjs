export const RULES = [
  { agent: "macofel", skill: "macofel-status", patterns: [/macofel|catalogo|pendente|produto/i] },
  { agent: "macofel", skill: "macofel-images-sync", patterns: [/sync imagem|sync imagens|sincronizar imagem/i] },
  { agent: "heimdall", skill: "vercel-status", patterns: [/texte|portal.*deploy|deploy.*portal|deploy.*texte|ultimo deploy.*texte/i] },
  { agent: "heimdall", skill: "deploy-monitor", patterns: [/status portal|portal.*no ar|site.*portal|lwdigitalforge|digital.?forge.*portal/i] },
  { agent: "heimdall", skill: "github-aldebaran", patterns: [/github|repo|reposit|issue|commit|push|aldebaran|texte|lwdigitalforge/i] },
  { agent: "heimdall", skill: "vercel-status", patterns: [/vercel|deployment|deployments|ultimo deploy/i] },
  { agent: "heimdall", skill: "deploy-monitor", patterns: [/site.*no ar|sites no ar|health macofel|macofel.*no ar|online/i] },
  { agent: "vp-pecas", skill: "vp-pecas-health", patterns: [/vp-pecas|vp-precision|usinagem|nalva/i] },
  { agent: "yato", skill: "innovation-research", patterns: [/pesquisa( de)? mercado|marketing digital|yato|sophia|tendencia|concorren/i] },
  { agent: "gideon", skill: "innovation-viability", patterns: [/viabil|gideon|senku|previs|antecip|score inov/i] },
  { agent: "rebeca", skill: "innovation-design", patterns: [/design|rebeca|brief visual|ui office|ui forge/i] },
  { agent: "veldora", skill: "security-audit", patterns: [/seguranc|veldora|odin|auditoria|politica openclaw/i] },
  { agent: "rimuru", skill: "innovation-monitor", patterns: [/token|consumo|rimuru|athena|openrouter|quota|uso api/i] },
  { agent: "hefestos", skill: "innovation-build", patterns: [/hefestos|construir skill|implementar melhoria/i] },
  { agent: "icaro", skill: "innovation-test", patterns: [/icaro|testar agente|validar config/i] },
  { agent: "jarvis", skill: "help", patterns: [/^(ajuda|help|menu|comandos|agentes)$/i, /ola|jarvis|quem e voce/i] },
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
