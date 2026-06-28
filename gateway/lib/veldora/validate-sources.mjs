/**
 * Validação de fontes externas — Veldora (allowlist por prefixo HTTPS).
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

let allowCache = null;
let blockCache = null;

function readPrefixList(filename) {
  const path = join(__dirname, filename);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export function loadAllowedPrefixes() {
  if (!allowCache) allowCache = readPrefixList('sources-allowlist.txt');
  return allowCache;
}

export function loadBlockedPrefixes() {
  if (!blockCache) blockCache = readPrefixList('sources-blocklist.txt');
  return blockCache;
}

/** @param {string} url */
export function isBlockedSource(url) {
  if (!url || typeof url !== 'string') return false;
  const normalized = url.trim();
  return loadBlockedPrefixes().some((prefix) => normalized.startsWith(prefix));
}

/**
 * Verifica se uma URL está na lista de fontes confiáveis (prefixo + HTTPS).
 * @param {string} url
 */
export function isAllowedSource(url) {
  if (!url || typeof url !== 'string') return false;
  const normalized = url.trim();
  if (!normalized.startsWith('https://')) return false;
  if (isBlockedSource(normalized)) return false;
  return loadAllowedPrefixes().some((prefix) => normalized.startsWith(prefix));
}

/**
 * @param {string[]} urls
 */
export function filterAllowedUrls(urls) {
  if (!Array.isArray(urls)) return [];
  return urls.filter((url) => isAllowedSource(url));
}

export function extractUrlsFromText(text) {
  return [...String(text || '').matchAll(URL_RE)].map((m) => m[0]);
}

/** Agentes cujo encaminhamento com URL no pedido exige allowlist. */
export const RESEARCH_GUARD_AGENTS = new Set([
  'yato',
  'sophia',
  'gideon',
  'senku',
  'rebeca',
  'hefestos',
]);

/**
 * Valida uma URL antes de requisição externa.
 * @returns {{ allowed: boolean, reason: string|null, agent?: string, targetUrl?: string, timestamp: string }}
 */
export function validateRequest(agentId, targetUrl, context = {}) {
  const timestamp = new Date().toISOString();
  const url = String(targetUrl || '').trim();

  if (!url) {
    return { allowed: true, reason: null, agent: agentId, timestamp };
  }

  if (isBlockedSource(url)) {
    return {
      allowed: false,
      reason: `Fonte bloqueada: ${url}. Veldora rejeitou (blocklist).`,
      agent: agentId,
      targetUrl: url,
      timestamp,
      context,
    };
  }

  if (!isAllowedSource(url)) {
    return {
      allowed: false,
      reason: `Fonte não autorizada: ${url}. Adicione prefixo em agents/veldora/sources-allowlist.txt`,
      agent: agentId,
      targetUrl: url,
      timestamp,
      context,
    };
  }

  return { allowed: true, reason: null, agent: agentId, targetUrl: url, timestamp, context };
}

/**
 * Valida todas as URLs num pedido de orquestração.
 */
export function validateTaskUrls(agentId, task = '') {
  const id = String(agentId || '').toLowerCase();
  const timestamp = new Date().toISOString();

  if (!RESEARCH_GUARD_AGENTS.has(id)) {
    return { allowed: true, reason: null, agent: id, timestamp, urls: [] };
  }

  const urls = extractUrlsFromText(task);
  if (!urls.length) {
    return { allowed: true, reason: null, agent: id, timestamp, urls: [] };
  }

  for (const targetUrl of urls) {
    const check = validateRequest(id, targetUrl, { taskPreview: String(task).slice(0, 200) });
    if (!check.allowed) return { ...check, urls };
  }

  return { allowed: true, reason: null, agent: id, timestamp, urls };
}
