#!/usr/bin/env node
/**
 * Hefestos — proposta de construção (skill scaffold) a partir de predição Gideon.
 * Escrita no repo só com --apply E confirmação explícita (POLITICA-SEGURANCA).
 *
 * Uso:
 *   node scripts/hefestos-build.mjs --file data/innovation/.../gideon_*.json
 *   node scripts/hefestos-build.mjs --topic "tema"
 *   node scripts/hefestos-build.mjs --apply --approved   # exige HEFESTOS_APPROVED=sim no .env
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { findLatestOne, getRoot } from './lib/innovation-io.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = getRoot();
const THRESHOLD = Number(process.env.GIDEON_THRESHOLD || 70);

function loadEnv() {
  const p = resolve(root, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}
loadEnv();

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function findGideonFile(topic) {
  const fileArg = arg('--file');
  if (fileArg && existsSync(fileArg)) return fileArg;
  const dayDir = resolve(root, 'data', 'innovation');
  if (!existsSync(dayDir)) return null;
  const dirs = readdirSync(dayDir)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  for (const d of dirs) {
    const p = findLatestOne(join(dayDir, d), 'gideon', '.json');
    if (p) return p;
  }
  return null;
}

function buildProposal(gideon, topic) {
  const score = gideon.confianca_score ?? gideon.viabilidade_score ?? 0;
  const rec = gideon.recomendacao || 'arquivar';
  const skillSlug = slug(topic || gideon.topico || 'nova-skill');
  return {
    ok: score >= THRESHOLD && rec === 'hefestos',
    hefestos_id: `hefestos_${Date.now()}`,
    topico: topic || gideon.topico,
    gideon_score: score,
    recomendacao: rec,
    tipo: 'skill',
    artefactos: [
      { path: `skills/${skillSlug}/SKILL.md`, action: 'create' },
      { path: 'gateway/skills/manifest.json', action: 'register_skill', skill: skillSlug },
    ],
    mensagem_telegram:
      `Hefestos: proposta skill \`${skillSlug}\` (score ${score}). Responda sim para aplicar no repo.`,
    requer_aprovacao: true,
  };
}

function applySkill(proposal) {
  const approved =
    process.argv.includes('--approved') &&
    /^(sim|confirmar|ok|yes|1)$/i.test(process.env.HEFESTOS_APPROVED || '');
  if (!approved) {
    console.error('[Hefestos] Bloqueado: use --approved e HEFESTOS_APPROVED=sim no .env');
    process.exit(1);
  }
  const skillPath = proposal.artefactos[0].path;
  const dir = resolve(root, dirname(skillPath));
  mkdirSync(dir, { recursive: true });
  const name = skillPath.split('/')[1];
  const md = `---
name: ${name}
description: Gerado por Hefestos — ${proposal.topico}
---

# ${name}

Skill gerada a partir da predição Gideon (score ${proposal.gideon_score}).

Rever e completar antes de registar em produção.
`;
  writeFileSync(resolve(root, skillPath), md, 'utf8');
  console.log('[Hefestos] Criado:', skillPath);
  console.log('Registar manualmente em gateway/skills/manifest.json se necessário.');
}

async function main() {
  const topic = arg('--topic');
  const gPath = findGideonFile(topic);
  if (!gPath) {
    console.error('Sem ficheiro gideon_*.json. Corra: node scripts/gideon-predict.mjs');
    process.exit(1);
  }
  const gideon = JSON.parse(readFileSync(gPath, 'utf8'));
  const proposal = buildProposal(gideon, topic);

  const propDir = resolve(root, 'data', 'innovation', 'proposals');
  mkdirSync(propDir, { recursive: true });
  const propPath = join(propDir, `${proposal.hefestos_id}.json`);
  writeFileSync(propPath, JSON.stringify(proposal, null, 2), 'utf8');

  console.log(JSON.stringify(proposal, null, 2));
  console.log('\nProposta:', propPath);

  if (!proposal.ok) {
    console.log(`[--] Score < ${THRESHOLD} ou recomendação != hefestos`);
    process.exit(0);
  }

  if (process.argv.includes('--apply')) {
    applySkill(proposal);
  } else {
    console.log('\nPara aplicar no repo: node scripts/hefestos-build.mjs --apply --approved (com HEFESTOS_APPROVED=sim)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
