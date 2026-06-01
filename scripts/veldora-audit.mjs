#!/usr/bin/env node
/**
 * Auditoria Veldora — política, PII, secrets, fontes de pesquisa.
 *
 * Uso:
 *   node scripts/veldora-audit.mjs --text "mensagem a auditar"
 *   node scripts/veldora-audit.mjs --file data/innovation/.../yato_*.yaml
 *   node scripts/veldora-audit.mjs --url "https://github.com/..."
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  auditText,
  auditResearchUrl,
  auditResearchEntry,
  formatAuditTelegram,
} from './lib/veldora-audit-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { text: null, file: null, url: null, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--text' && argv[i + 1]) out.text = argv[++i];
    else if (a === '--file' && argv[i + 1]) out.file = argv[++i];
    else if (a === '--url' && argv[i + 1]) out.url = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

/** Extrai campos mínimos de pesquisa-entry.yaml sem dependência yaml. */
function loadPesquisaEntry(path) {
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) throw new Error('ficheiro não encontrado: ' + abs);
  const text = readFileSync(abs, 'utf8');
  const scalar = (key) => {
    const m = text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (!m) return null;
    return m[1].trim().replace(/^["']|["']$/g, '');
  };
  const nested = (key) => {
    const m = text.match(new RegExp(`^\\s+${key}:\\s*(.+)$`, 'm'));
    if (!m) return null;
    return m[1].trim().replace(/^["']|["']$/g, '');
  };
  return {
    topico: scalar('topico'),
    ferramenta: {
      link: nested('link'),
      fonte: nested('fonte'),
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.text && !args.file && !args.url)) {
    console.log(`Uso:
  node scripts/veldora-audit.mjs --text "pedido ou resposta"
  node scripts/veldora-audit.mjs --file data/innovation/.../yato_001.yaml
  node scripts/veldora-audit.mjs --url "https://github.com/..."
  --json  saída JSON (default: texto para Telegram)`);
    process.exit(args.help ? 0 : 1);
  }

  let result;

  if (args.url) {
    const u = auditResearchUrl(args.url);
    result = {
      ok: u.ok,
      veredito: u.ok ? 'aprovado' : 'bloqueado',
      checks: [
        {
          id: 'fonte-url',
          status: u.ok ? 'ok' : 'falha',
          mensagem: u.ok ? `${u.tier} — ${u.host}` : u.reason || 'rejeitada',
        },
      ],
      recomendacao: u.ok
        ? 'URL aceite para pesquisa.'
        : 'Adicionar prefixo em agents/veldora/sources-allowlist.txt ou usar URL aprovada.',
      source: 'veldora-audit',
      gerado_em: new Date().toISOString(),
    };
  } else if (args.file) {
    const entry = loadPesquisaEntry(args.file);
    const entryChecks = auditResearchEntry(entry);
    const textAudit = auditText(JSON.stringify(entry), { context: 'pesquisa-yaml' });
    const checks = [...entryChecks, ...textAudit.checks.filter((c) => c.id !== 'fonte-url')];
    const hasFail = checks.some((c) => c.status === 'falha');
    const hasWarn = checks.some((c) => c.status === 'aviso');
    result = {
      ok: !hasFail,
      veredito: hasFail ? 'bloqueado' : hasWarn ? 'revisar' : 'aprovado',
      checks,
      recomendacao: hasFail
        ? 'Entrada de pesquisa incompleta ou fonte não confiável — Yato deve corrigir antes de Gideon/Hefestos.'
        : 'Entrada válida para pipeline de inovação.',
      source: 'veldora-audit',
      gerado_em: new Date().toISOString(),
      file: args.file,
    };
  } else {
    result = auditText(args.text, { context: 'cli' });
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatAuditTelegram(result));
  }
  process.exit(result.ok ? 0 : 1);
}

main();
