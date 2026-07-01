#!/usr/bin/env node
/**
 * Segundo cérebro OpenClaw — standup, dump, wrap-up, weekly.
 *
 * Uso:
 *   node scripts/brain.mjs standup
 *   node scripts/brain.mjs dump "reunião com X, decidimos Y"
 *   node scripts/brain.mjs wrap-up
 *   node scripts/brain.mjs weekly
 *   node scripts/brain.mjs search "rimuru gate"
 */
import {
  appendToDaily,
  extractSection,
  fileAgeDays,
  listProjectNotes,
  readText,
  resolveVaultPath,
  todayIso,
  vaultPaths,
  yesterdayIso,
} from './lib/brain-vault.mjs';
import { searchLocalCorpus } from './corpus-search-local.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const text = rest.join(' ').trim();

function printHeader(title) {
  console.log(`\n=== ${title} ===\n`);
}

function standup() {
  const vault = resolveVaultPath();
  const paths = vaultPaths(vault);
  printHeader(`OpenClaw Brain — standup (${todayIso()})`);
  console.log(`Vault: ${vault}\n`);

  const north = readText(paths.northStar);
  if (north) {
    const focus = extractSection(north, 'Current Focus') || north.slice(0, 1200);
    console.log('## North Star (Current Focus)\n');
    console.log(focus);
    console.log('');
  } else {
    console.log('⚠ North Star não encontrado em brain/North Star.md\n');
  }

  const yesterday = readText(paths.dailyYesterday);
  if (yesterday) {
    console.log(`## Ontem (${yesterdayIso()})\n`);
    const dump = extractSection(yesterday, 'Dump') || yesterday.slice(0, 600);
    console.log(dump || '(sem dump)');
    console.log('');
  }

  const today = readText(paths.dailyToday);
  if (today) {
    console.log(`## Hoje (${todayIso()})\n`);
    const hoje = extractSection(today, 'Hoje (30s)') || extractSection(today, 'Hoje');
    if (hoje) console.log(hoje);
    console.log('');
  }

  const projects = listProjectNotes(vault);
  const active = projects.filter((p) => p.status === 'active');
  const someday = projects.filter((p) => p.status === 'someday');

  console.log('## Projetos active\n');
  if (active.length) {
    for (const p of active) console.log(`- ${p.name}`);
  } else {
    console.log('(nenhum com status: active)');
  }

  if (someday.length) {
    console.log('\n## Projetos someday (referência)\n');
    for (const p of someday) console.log(`- ${p.name}`);
  }

  console.log('\n---\nPróximo: foco no topo da lista active. Dump: `node scripts/brain.mjs dump "..."`');
}

function dump() {
  if (!text) {
    console.error('Uso: node scripts/brain.mjs dump "texto livre"');
    process.exit(1);
  }
  const vault = resolveVaultPath();
  const path = appendToDaily(vault, text);
  printHeader('Dump registado');
  console.log(`Vault: ${vault}`);
  console.log(`Nota: ${path}`);
  console.log('\nO agente pode estruturar depois (people/projects/decisões).');
}

function wrapUp() {
  const vault = resolveVaultPath();
  const paths = vaultPaths(vault);
  printHeader(`Wrap-up (${todayIso()})`);

  const today = readText(paths.dailyToday);
  const dump = extractSection(today, 'Dump');
  const hasDump = Boolean(dump && dump.replace(/[-\s]/g, '').length > 0);

  console.log(`Vault: ${vault}`);
  console.log(`Daily: ${paths.dailyToday}`);
  console.log(`Dump hoje: ${hasDump ? 'sim' : 'não — considera registar algo'}`);

  const projects = listProjectNotes(vault);
  const stale = projects.filter((p) => {
    const age = fileAgeDays(p.path);
    return p.status === 'active' && age !== null && age > 14;
  });

  if (stale.length) {
    console.log('\n## Projetos active sem update há 14+ dias\n');
    for (const p of stale) console.log(`- ${p.name}`);
  }

  console.log('\n## Checklist\n');
  console.log('- [ ] Links nas notas do dia apontam para projects/people certos');
  console.log('- [ ] Decisões importantes em brain/Key Decisions (se existir)');
  console.log('- [ ] Notas maduras promovidas para OpenClaw/docs/ + corpus allowlist');
}

function weekly() {
  const vault = resolveVaultPath();
  printHeader(`Weekly (${todayIso()})`);
  console.log(`Vault: ${vault}\n`);

  const projects = listProjectNotes(vault);
  console.log('## Projetos\n');
  for (const p of projects) {
    console.log(`- ${p.name} (${p.status})`);
  }

  const north = readText(vaultPaths(vault).northStar);
  const goals = extractSection(north, 'Goals') || extractSection(north, 'Short-term (This Quarter)');
  if (goals) {
    console.log('\n## Objetivos (North Star)\n');
    console.log(goals);
  }

  console.log('\n---\nRevisar: o que avançou? o que evitaste? prioridade próxima semana?');
}

function searchCorpus() {
  if (!text) {
    console.error('Uso: node scripts/brain.mjs search "termos" [--agent=heimdall via segundo arg]');
    process.exit(1);
  }
  const agentMatch = text.match(/--agent=(\w[\w-]*)/);
  const agent = agentMatch ? agentMatch[1] : null;
  const query = text.replace(/--agent=\S+/g, '').trim();
  const report = searchLocalCorpus(query, { agent, limit: 5 });
  printHeader(`Corpus local — «${query}»`);
  if (!report.ok) {
    console.error(report.error);
    process.exit(1);
  }
  if (!report.hits.length) {
    console.log('Nenhum hit. Adiciona doc a config/corpus-allowlist.txt');
    return;
  }
  for (const h of report.hits) {
    console.log(`\n## ${h.path} (score ${h.score}, agent=${h.agent})\n`);
    console.log(h.text.slice(0, 600));
  }
  console.log('\n---\nIngest HF: node scripts/hf-ingest-corpus.mjs --dry-run');
}

function usage() {
  console.log(`Uso: node scripts/brain.mjs <standup|dump|wrap-up|weekly|search> [texto]

Variável: OPENCLAW_BRAIN_VAULT (default: H:\\Meu Drive\\Projetos\\Celebro LW)`);
}

try {
  switch (cmd) {
    case 'standup':
      standup();
      break;
    case 'dump':
      dump();
      break;
    case 'wrap-up':
    case 'wrapup':
      wrapUp();
      break;
    case 'weekly':
      weekly();
      break;
    case 'search':
      searchCorpus();
      break;
    default:
      usage();
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error('Erro:', e.message);
  process.exit(1);
}
