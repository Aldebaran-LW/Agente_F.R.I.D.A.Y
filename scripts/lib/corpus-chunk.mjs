/**
 * Chunking de markdown para corpus/ no Dataset HF.
 */

const SECRET_PATTERNS = [
  /\bhf_[a-zA-Z0-9]{20,}\b/g,
  /\bsk-[a-zA-Z0-9]{20,}\b/g,
  /\bBearer\s+[a-zA-Z0-9._-]+/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
];

const AGENT_BY_PATH = [
  [/agents\/macofel|macofel|MACOFEL/i, 'macofel'],
  [/agents\/heimdall|heimdall|CRON-HEIMDALL|github-aldebaran|deploy-monitor/i, 'heimdall'],
  [/vp-pecas|VP-Pecas/i, 'vp-pecas'],
  [/innovation|sophia|yato|senku|gideon|hefestos|rebeca/i, 'sophia'],
  [/veldora|POLITICA-SEGURANCA|seguranca/i, 'veldora'],
  [/dedalo|data-schema|corpus/i, 'dedalo'],
  [/orchestrator|JARVIS|jarvis/i, 'orchestrator'],
];

export function scrubSecrets(text) {
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

export function inferAgent(relPath) {
  for (const [re, agent] of AGENT_BY_PATH) {
    if (re.test(relPath)) return agent;
  }
  if (relPath.startsWith('docs/')) return 'orchestrator';
  if (relPath.startsWith('skills/')) return 'orchestrator';
  return 'shared';
}

export function inferTags(relPath) {
  const tags = [];
  const base = relPath.replace(/\\/g, '/');
  if (base.includes('POLITICA')) tags.push('seguranca', 'politica');
  if (base.startsWith('docs/')) tags.push('doc');
  if (base.startsWith('skills/')) tags.push('skill');
  if (base.startsWith('agents/')) tags.push('agent');
  if (base.includes('INOVACAO') || base.includes('innovation')) tags.push('innovacao');
  if (base.includes('CRON')) tags.push('cron');
  if (base.includes('GATEWAY') || base.includes('VERCEL')) tags.push('gateway');
  if (base.includes('HF') || base.includes('DATASET')) tags.push('huggingface');
  return [...new Set(tags)];
}

/**
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
export function chunkText(text, maxChars = 3800) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks = [];
  const paragraphs = normalized.split(/\n{2,}/);
  let buf = '';

  for (const para of paragraphs) {
    const piece = buf ? `${buf}\n\n${para}` : para;
    if (piece.length <= maxChars) {
      buf = piece;
      continue;
    }
    if (buf) chunks.push(buf);
    if (para.length <= maxChars) {
      buf = para;
      continue;
    }
    for (let i = 0; i < para.length; i += maxChars) {
      chunks.push(para.slice(i, i + maxChars));
    }
    buf = '';
  }
  if (buf) chunks.push(buf);
  return chunks;
}

/**
 * @param {object} opts
 * @returns {object[]}
 */
export function buildCorpusRecords({ relPath, content, gitSha = null }) {
  const agent = inferAgent(relPath);
  const tags = inferTags(relPath);
  const safe = scrubSecrets(content);
  const chunks = chunkText(safe);
  const at = new Date().toISOString();
  const slug = relPath.replace(/\\/g, '/').replace(/[^a-zA-Z0-9._/-]/g, '_');

  return chunks.map((text, i) => ({
    id: `corpus:${agent}:${slug}:chunk-${i}`,
    at,
    agent,
    source: 'repo:Agente_OpenClaw',
    path: relPath.replace(/\\/g, '/'),
    git_sha: gitSha,
    tags,
    text,
    meta: { lang: 'pt', kind: 'doc', version: 1, chunk: i, chunk_total: chunks.length },
  }));
}
