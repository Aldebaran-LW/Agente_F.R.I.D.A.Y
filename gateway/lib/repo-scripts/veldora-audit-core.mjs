/**
 * Núcleo de auditoria Veldora — regras determinísticas (sem LLM).
 * Política: POLITICA-SEGURANCA.md + agents/veldora/sources-allowlist.txt
 */
import { isAllowedSource, isBlockedSource } from '../veldora/validate-sources.mjs';

const PAYMENT_PATTERNS = [
  /\bpix\b/i,
  /\bboleto\b/i,
  /\bcheckout\b/i,
  /\bconfirmar\s+pagamento\b/i,
  /\bcomprar\s+agora\b/i,
  /\bcart[aã]o\s+de\s+cr[eé]dito\b/i,
  /\btransfer[eê]ncia\b/i,
  /\bstripe\b/i,
  /\bpaypal\b/i,
  /\bassinar\b.*\bplano\b/i,
];

const PII_PATTERNS = [
  { id: 'cpf', re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, label: 'CPF' },
  { id: 'email', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, label: 'e-mail' },
  {
    id: 'phone_br',
    re: /\b(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b/,
    label: 'telefone',
  },
];

const SECRET_PATTERNS = [
  { id: 'openai', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { id: 'github', re: /\bghp_[A-Za-z0-9]{20,}\b/ },
  { id: 'slack', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'bearer', re: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i },
  { id: 'mongodb', re: /\bmongodb(\+srv)?:\/\/[^\s]+/i },
  { id: 'aws_key', re: /\bAKIA[0-9A-Z]{16}\b/ },
];

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

/**
 * @param {string} url
 * @returns {{ ok: boolean, tier?: string, host?: string, reason?: string }}
 */
export function auditResearchUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'URL inválida' };
  }
  const host = parsed.hostname;
  if (parsed.protocol !== 'https:') {
    return { ok: false, host, reason: 'apenas HTTPS é aceite em pesquisa' };
  }
  if (isBlockedSource(url)) {
    return { ok: false, host, reason: 'prefixo bloqueado (sources-blocklist.txt)' };
  }
  if (isAllowedSource(url)) {
    return { ok: true, tier: 'allowlist', host };
  }
  return {
    ok: false,
    host,
    reason: 'fora da allowlist — editar agents/veldora/sources-allowlist.txt',
  };
}

export function extractUrls(text) {
  return [...String(text || '').matchAll(URL_RE)].map((m) => m[0]);
}

export function checkPoliticaPagamentos(text) {
  const hits = PAYMENT_PATTERNS.filter((re) => re.test(text));
  if (!hits.length) {
    return { status: 'ok', mensagem: 'sem indícios de pagamento/compra no texto' };
  }
  return {
    status: 'falha',
    mensagem: 'pedido toca pagamentos/compras — proibido pela política (mesmo com sim no chat)',
  };
}

export function checkPii(text) {
  const found = [];
  for (const { id, re, label } of PII_PATTERNS) {
    if (re.test(text)) found.push(label || id);
  }
  if (!found.length) {
    return { status: 'ok', mensagem: 'sem PII óbvio detectado' };
  }
  return {
    status: 'falha',
    mensagem: `possível PII (${found.join(', ')}) — não partilhar em Telegram/issues públicas`,
  };
}

export function checkSecrets(text) {
  const found = [];
  for (const { id, re } of SECRET_PATTERNS) {
    if (re.test(text)) found.push(id);
  }
  if (!found.length) {
    return { status: 'ok', mensagem: 'sem padrões de secret/token no texto' };
  }
  return {
    status: 'falha',
    mensagem: `possível secret exposto (${found.join(', ')}) — rodar chaves e nunca colar no chat`,
  };
}

export function checkUrlsInText(text) {
  const urls = extractUrls(text);
  if (!urls.length) {
    return { status: 'ok', mensagem: 'nenhuma URL no texto' };
  }
  const results = urls.map((u) => ({ url: u, ...auditResearchUrl(u) }));
  const bad = results.filter((r) => !r.ok);
  if (!bad.length) {
    return {
      status: 'ok',
      mensagem: `${urls.length} URL(s) na allowlist Veldora`,
      urls: results,
    };
  }
  const hosts = bad.map((b) => b.host || b.url).join(', ');
  return {
    status: bad.length === urls.length ? 'falha' : 'aviso',
    mensagem: `URL(s) não confiáveis: ${hosts}`,
    urls: results,
  };
}

/**
 * Valida entrada YAML de pesquisa (Yato) — embasamento mínimo.
 * @param {Record<string, unknown>} entry
 */
export function auditResearchEntry(entry) {
  const checks = [];
  const ferramenta = entry?.ferramenta ?? {};
  const link = ferramenta.link || ferramenta.url;
  const fonte = ferramenta.fonte || entry?.fonte;

  if (!entry?.topico) {
    checks.push({ id: 'pesquisa-topico', status: 'falha', mensagem: 'campo topico em falta' });
  } else {
    checks.push({ id: 'pesquisa-topico', status: 'ok', mensagem: 'tópico presente' });
  }

  if (!fonte || String(fonte).trim().length < 3) {
    checks.push({
      id: 'pesquisa-fonte',
      status: 'falha',
      mensagem: 'fonte ausente — indicar origem (ex.: GitHub Trending, HF Hub)',
    });
  } else {
    checks.push({ id: 'pesquisa-fonte', status: 'ok', mensagem: `fonte: ${String(fonte).slice(0, 80)}` });
  }

  if (!link) {
    checks.push({
      id: 'pesquisa-link',
      status: 'aviso',
      mensagem: 'link em falta — difícil verificar embasamento',
    });
  } else {
    const urlAudit = auditResearchUrl(String(link));
    checks.push({
      id: 'pesquisa-link',
      status: urlAudit.ok ? 'ok' : 'falha',
      mensagem: urlAudit.ok
        ? `link ${urlAudit.tier} (${urlAudit.host})`
        : urlAudit.reason || 'link rejeitado',
    });
  }

  return checks;
}

function worstStatus(checks) {
  if (checks.some((c) => c.status === 'falha')) return 'bloqueado';
  if (checks.some((c) => c.status === 'aviso')) return 'revisar';
  return 'aprovado';
}

/**
 * Auditoria completa de texto (pedido Telegram / resposta de agente).
 */
export function auditText(text, { context = 'pedido' } = {}) {
  const body = String(text || '');
  const checks = [
    { id: 'politica-pagamentos', ...checkPoliticaPagamentos(body) },
    { id: 'pii-vazamento', ...checkPii(body) },
    { id: 'secrets-expostos', ...checkSecrets(body) },
    { id: 'fonte-url', ...checkUrlsInText(body) },
  ];

  const veredito = worstStatus(checks);
  const ok = veredito === 'aprovado';

  let recomendacao;
  if (veredito === 'bloqueado') {
    recomendacao =
      'Bloquear envio automático. Reformular sem pagamentos/PII/secrets; usar apenas APIs autorizadas.';
  } else if (veredito === 'revisar') {
    recomendacao =
      'Revisão humana: confirmar URL na allowlist (sources-allowlist.txt) ou reformular pedido.';
  } else {
    recomendacao = 'Pedido alinhado com política e fontes. Pode prosseguir se o executor for aprovado.';
  }

  return {
    ok,
    veredito,
    context,
    checks,
    recomendacao,
    source: 'veldora-audit',
    gerado_em: new Date().toISOString(),
  };
}

export function formatAuditTelegram(result) {
  const icon = { aprovado: 'OK', revisar: 'REVISAR', bloqueado: 'BLOQUEADO' }[result.veredito] || '?';
  const lines = [
    `Veldora [${icon}]: ${result.recomendacao}`,
    '',
    ...result.checks.map((c) => `• ${c.id}: ${c.status} — ${c.mensagem}`),
  ];
  return lines.join('\n').slice(0, 1500);
}
