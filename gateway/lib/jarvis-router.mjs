export const RULES = [
  { agent: "macofel", skill: "macofel-status", patterns: [/macofel|catalogo|pendente|ean|imagem|produto/i] },
  { agent: "ops", skill: "github-aldebaran", patterns: [/github|repo|reposit|issue|commit|push|aldebaran/i] },
  { agent: "ops", skill: "deploy-monitor", patterns: [/deploy|site|no ar|vercel|health|online/i] },
  { agent: "vp-pecas", skill: "deploy-monitor", patterns: [/vp-pecas|vp-precision|usinagem|nalva/i] },
  { agent: "jarvis", skill: "help", patterns: [/ajuda|help|ola|jarvis|quem e voce/i] },
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