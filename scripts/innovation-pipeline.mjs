#!/usr/bin/env node
/**
 * Pipeline Sophia (conhecimento) → Yato (mercado) → Rebeca? → Senku → Gideon → Hefestos
 * Uso: node scripts/innovation-pipeline.mjs --topic "tema" [--dry-run] [--deterministic]
 *       [--stage all|sophia|yato|rebeca|senku|gideon]
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { loadAllAgentConfigs } from './lib/parse-agent-yaml.mjs';
import { FILE_PREFIXES, findLatestOne } from './lib/innovation-io.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const FILE_PREFIX_ALIASES = FILE_PREFIXES;

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

function argValue(flag) {
  const eq = process.argv.find((a) => a.startsWith(flag + '='));
  if (eq) return eq.slice(flag.length + 1);
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  return null;
}

function normStage(raw) {
  return (raw || 'all').toLowerCase();
}

function resolveAgentId(agentId) {
  return agentId;
}

function runScript(name, extra = []) {
  const script = resolve(__dirname, name);
  const r = spawnSync(process.execPath, [script, '--topic', topic, ...extra], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) throw new Error(`${name} exit ${r.status}`);
}

const topic = argValue('--topic') || 'ferramentas IA gratuitas para OpenClaw';
const dryRun = process.argv.includes('--dry-run');
const deterministic = process.argv.includes('--deterministic') || dryRun || !process.env.OPENROUTER_API_KEY;
const stage = normStage(argValue('--stage'));
const GIDEON_THRESHOLD = Number(
  process.env.GIDEON_THRESHOLD || process.env.SENKU_THRESHOLD || 70,
);

function todayDir() {
  const day = new Date().toISOString().slice(0, 10);
  const dir = resolve(root, 'data', 'innovation', day);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function nextId(prefix) {
  const dir = todayDir();
  const existing = readdirSync(dir).filter((f) => f.startsWith(prefix + '_'));
  const n = String(existing.length + 1).padStart(3, '0');
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}_${stamp}_${n}`;
}

function agentModel(agentId) {
  const configs = loadAllAgentConfigs(resolve(root, 'agents'));
  const id = resolveAgentId(agentId);
  const c = configs.find((a) => a.id === id);
  return c?.model || 'google/gemma-4-26b-a4b-it:free';
}

async function callOpenRouter(agentId, system, user) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;
  const model = agentModel(agentId);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/Aldebaran-LW/Agente_OpenClaw',
      'X-Title': 'OpenClaw Innovation Pipeline',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function yamlScalar(v) {
  if (v === null || v === undefined) return '""';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (/[:#\n]/.test(s) || s.includes('"')) return JSON.stringify(s);
  return s;
}

function writeYaml(path, obj) {
  const lines = ['# gerado por innovation-pipeline.mjs'];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v)) lines.push(`  ${k2}: ${yamlScalar(v2)}`);
    } else {
      lines.push(`${k}: ${yamlScalar(v)}`);
    }
  }
  writeFileSync(path, lines.join('\n') + '\n', 'utf8');
}

async function runSophia() {
  if (deterministic) {
    runScript('sophia-research.mjs');
    return { outPath: findLatestOne(todayDir(), 'sophia', '.json') };
  }
  const pesquisaId = nextId('sophia');
  const outPath = join(todayDir(), `${pesquisaId}.yaml`);
  const system = `Tu es Sophia, pesquisa de CONHECIMENTO OpenClaw (ferramentas, libs, tutoriais, tecnologias). Portugues, YAML unico:
pesquisa_id, gerado_em, agente: sophia, topico, ferramenta (nome, categoria, link, caso_uso, retorno_estimado, fonte), notas, proximo_passo: senku`;
  let body;
  if (dryRun || !process.env.OPENROUTER_API_KEY) {
    body = { pesquisa_id: pesquisaId, agente: 'sophia', topico: topic, proximo_passo: 'senku', notas: 'dry-run' };
  } else {
    const raw = await callOpenRouter('sophia', system, `Topico: ${topic}`);
    body = { pesquisa_id: pesquisaId, agente: 'sophia', topico: topic, raw_llm: raw, proximo_passo: 'senku' };
  }
  writeYaml(outPath, body);
  console.log('[Sophia] ->', outPath);
  return { outPath, pesquisaId };
}

async function runYato() {
  if (deterministic) {
    runScript('yato-market-search.mjs');
    return { outPath: findLatestOne(todayDir(), 'yato', '.json') };
  }
  const pesquisaId = nextId('yato');
  const outPath = join(todayDir(), `${pesquisaId}.yaml`);
  const system = `Tu es Yato, pesquisa de MERCADO OpenClaw (concorrencia, demanda, posicionamento). Portugues, YAML:
pesquisa_id, gerado_em, agente: yato, topico, ferramenta, notas, proximo_passo: senku`;
  let body;
  if (dryRun || !process.env.OPENROUTER_API_KEY) {
    body = { pesquisa_id: pesquisaId, agente: 'yato', topico: topic, proximo_passo: 'senku', notas: 'dry-run' };
  } else {
    const raw = await callOpenRouter('yato', system, `Topico mercado: ${topic}`);
    body = { pesquisa_id: pesquisaId, agente: 'yato', topico: topic, raw_llm: raw, proximo_passo: 'senku' };
  }
  writeYaml(outPath, body);
  console.log('[Yato mercado] ->', outPath);
  return { outPath, pesquisaId };
}

async function runRebeca(contextPath) {
  const designId = nextId('rebeca');
  const outPath = join(todayDir(), `${designId}.yaml`);
  const ctx = contextPath && existsSync(contextPath) ? readFileSync(contextPath, 'utf8').slice(0, 3000) : '';
  const system = `Tu es Rebeca, design /office e /forge. YAML: design_id, paleta, componentes[], notas.`;
  let body;
  if (dryRun || !process.env.OPENROUTER_API_KEY) {
    body = { design_id: designId, notas: 'dry-run', proximo_passo: 'senku' };
  } else {
    const raw = await callOpenRouter('rebeca', system, `Contexto:\n${ctx}`);
    body = { design_id: designId, raw_llm: raw };
  }
  writeYaml(outPath, body);
  console.log('[Rebeca] ->', outPath);
  return outPath;
}

async function runSenku() {
  if (deterministic) {
    runScript('senku-process.mjs');
    return findLatestOne(todayDir(), 'senku', '.json');
  }
  console.log('[Senku] Use --deterministic ou OPENROUTER stage futuro');
  runScript('senku-process.mjs');
  return findLatestOne(todayDir(), 'senku', '.json');
}

async function runGideon() {
  if (deterministic) {
    runScript('gideon-predict.mjs');
    return findLatestOne(todayDir(), 'gideon', '.json');
  }
  const senkuPath = findLatestOne(todayDir(), 'senku', '.json');
  const context = senkuPath ? readFileSync(senkuPath, 'utf8').slice(0, 5000) : '';
  const gideonId = nextId('gideon');
  const outPath = join(todayDir(), `${gideonId}.yaml`);
  const system = `Tu es Gideon — PREDICAO e cenarios futuros a partir da analise Senku. NAO correlacionas dados (isso e Senku).
YAML: gideon_id, cenarios[], confianca_score 0-100, recomendacao (hefestos|arquivar|mais_pesquisa), justificativa.`;
  let body;
  if (dryRun || !process.env.OPENROUTER_API_KEY) {
    runScript('gideon-predict.mjs');
    return findLatestOne(todayDir(), 'gideon', '.json');
  }
  const raw = await callOpenRouter('gideon', system, context);
  body = { gideon_id: gideonId, raw_llm: raw };
  writeYaml(outPath, body);
  console.log('[Gideon LLM] ->', outPath);
  return outPath;
}

function findLatestResearchFile(dir, agentStage) {
  const prefixes = FILE_PREFIX_ALIASES[agentStage] || [`${agentStage}_`];
  for (const prefix of prefixes) {
    const files = readdirSync(dir).filter((f) => f.startsWith(prefix)).sort();
    if (files.length) return join(dir, files[files.length - 1]);
  }
  return null;
}

async function main() {
  console.log('=== Innovation pipeline ===');
  console.log('Topico:', topic);
  console.log('Stage:', stage, deterministic ? '(deterministico)' : dryRun ? '(dry-run)' : '');

  let sophiaPath;
  if (stage === 'all' || stage === 'sophia') {
    sophiaPath = (await runSophia())?.outPath;
  }

  let yatoPath;
  if (stage === 'all' || stage === 'yato') {
    yatoPath = (await runYato())?.outPath;
  }

  let rebecaPath;
  const wantRebeca =
    stage === 'rebeca' || (stage === 'all' && process.argv.includes('--with-rebeca'));
  if (wantRebeca) {
    rebecaPath = await runRebeca(sophiaPath || yatoPath);
  }

  if (stage === 'all' || stage === 'senku') {
    await runSenku();
  }

  if (stage === 'all' || stage === 'gideon') {
    await runGideon();
  }

  console.log('\nDataset HF (futuro): knowledge/ market/ analysis/ predictions/');
  console.log('Memoria: node scripts/hf-ingest-learning.mjs --agent gideon --text "resumo"');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
