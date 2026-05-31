#!/usr/bin/env node
/**
 * Pipeline Yato → Rebeca (opcional) → Gideon → recomendação Hefestos
 * Uso: node scripts/innovation-pipeline.mjs --topic "tema" [--dry-run] [--stage all|yato|gideon]
 * Aliases legados: sophia → yato, senku → gideon
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadAllAgentConfigs } from './lib/parse-agent-yaml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const STAGE_ALIASES = { sophia: 'yato', senku: 'gideon' };
const FILE_PREFIX_ALIASES = { yato: ['yato_', 'sophia_'], gideon: ['gideon_', 'senku_'] };

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
  const s = (raw || 'all').toLowerCase();
  return STAGE_ALIASES[s] || s;
}

function resolveAgentId(agentId) {
  return STAGE_ALIASES[agentId] || agentId;
}

const topic = argValue('--topic') || 'ferramentas IA gratuitas para OpenClaw';
const dryRun = process.argv.includes('--dry-run');
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

async function runYato() {
  const pesquisaId = nextId('yato');
  const outPath = join(todayDir(), `${pesquisaId}.yaml`);
  const system = `Tu es Yato, agente de pesquisa de mercado e marketing digital OpenClaw. Responde em portugues.
Gera UM unico bloco YAML valido (sem markdown) com: pesquisa_id, gerado_em, agente, topico, ferramenta (nome, categoria, link, caso_uso, retorno_estimado: baixa|media|alta, fonte), notas, proximo_passo.
Fontes: mercado, concorrentes, HF Hub, Product Hunt, redes sociais, tendencias digitais.`;

  let body;
  if (dryRun || !process.env.OPENROUTER_API_KEY) {
    body = {
      pesquisa_id: pesquisaId,
      gerado_em: new Date().toISOString(),
      agente: 'yato',
      topico: topic,
      ferramenta: {
        nome: '[dry-run] Exemplo Tool',
        categoria: ['gratuita', 'api'],
        link: 'https://huggingface.co',
        caso_uso: `Aplicar ao tema: ${topic}`,
        retorno_estimado: 'media',
        fonte: 'dry-run',
      },
      notas: 'Executar sem --dry-run e com OPENROUTER_API_KEY para pesquisa LLM.',
      proximo_passo: 'gideon',
    };
  } else {
    const raw = await callOpenRouter('yato', system, `Topico: ${topic}`);
    try {
      const cleaned = raw.replace(/^```ya?ml?\n?/i, '').replace(/\n?```$/i, '');
      body = { pesquisa_id: pesquisaId, parse_llm: true, raw: cleaned };
    } catch {
      body = { pesquisa_id: pesquisaId, agente: 'yato', topico: topic, raw_llm: raw };
    }
  }

  writeYaml(outPath, body);
  console.log('[Yato] ->', outPath);
  return { outPath, body, pesquisaId };
}

async function runRebeca(yatoPath) {
  const designId = nextId('rebeca');
  const outPath = join(todayDir(), `${designId}.yaml`);
  const yatoText = readFileSync(yatoPath, 'utf8').slice(0, 3000);
  const system = `Tu es Rebeca, design para dashboards /office e /forge OpenClaw. Responde em portugues com brief YAML: design_id, paleta, componentes[], referencias_visuais[], notas.`;

  let body;
  if (dryRun || !process.env.OPENROUTER_API_KEY) {
    body = {
      design_id: designId,
      baseado_em: yatoPath,
      paleta: ['#0b0f14', '#6eb5ff', '#3dd68c'],
      componentes: ['cards agentes', 'status forge'],
      notas: 'dry-run',
    };
  } else {
    const raw = await callOpenRouter('rebeca', system, `Pesquisa Yato:\n${yatoText}`);
    body = { design_id: designId, raw_llm: raw };
  }
  writeYaml(outPath, body);
  console.log('[Rebeca] ->', outPath);
  return outPath;
}

async function runGideon(yatoPath, rebecaPath) {
  const gideonId = nextId('gideon');
  const outPath = join(todayDir(), `${gideonId}.yaml`);
  const context = readFileSync(yatoPath, 'utf8').slice(0, 4000)
    + (rebecaPath && existsSync(rebecaPath) ? '\n' + readFileSync(rebecaPath, 'utf8').slice(0, 2000) : '');

  const system = `Tu es Gideon. Com base nos dados, antecipa riscos e oportunidades antes que aconteçam.
Avalia viabilidade com 4 subscores 0-100: custo_implementacao, retorno_lucrativo, compatibilidade_stack, manutenibilidade.
Pesos: 30%, 35%, 20%, 15%. Calcula viabilidade_score final.
Responde YAML: gideon_id, pesquisa_id, subscores{}, viabilidade_score, recomendacao (hefestos|arquivar|mais_pesquisa), justificativa.`;

  let body;
  if (dryRun || !process.env.OPENROUTER_API_KEY) {
    const sub = { custo_implementacao: 75, retorno_lucrativo: 70, compatibilidade_stack: 85, manutenibilidade: 80 };
    const score = Math.round(
      sub.custo_implementacao * 0.3
      + sub.retorno_lucrativo * 0.35
      + sub.compatibilidade_stack * 0.2
      + sub.manutenibilidade * 0.15,
    );
    body = {
      gideon_id: gideonId,
      subscores: sub,
      viabilidade_score: score,
      recomendacao: score >= GIDEON_THRESHOLD ? 'hefestos' : 'arquivar',
      justificativa: 'dry-run com subscores exemplo',
      threshold: GIDEON_THRESHOLD,
    };
  } else {
    const raw = await callOpenRouter('gideon', system, context);
    body = { gideon_id: gideonId, raw_llm: raw };
    const m = raw.match(/viabilidade_score:\s*(\d+)/i);
    if (m) body.viabilidade_score = Number(m[1]);
  }

  writeYaml(outPath, body);
  console.log('[Gideon] ->', outPath, 'score=', body.viabilidade_score ?? '?');

  if ((body.viabilidade_score ?? 0) >= GIDEON_THRESHOLD) {
    console.log('[OK] Elegivel para Hefestos — requer aprovacao humana para producao.');
  } else {
    console.log('[--] Abaixo do threshold', GIDEON_THRESHOLD, '— arquivar ou mais pesquisa.');
  }
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
  console.log('Stage:', stage, dryRun ? '(dry-run)' : '');

  let yatoPath;
  if (stage === 'all' || stage === 'yato') {
    const s = await runYato();
    yatoPath = s.outPath;
  } else {
    const dir = todayDir();
    yatoPath = findLatestResearchFile(dir, 'yato');
    if (!yatoPath) {
      console.error('Sem ficheiro yato_* ou sophia_* em', dir);
      process.exit(1);
    }
  }

  let rebecaPath;
  if (stage === 'all' || stage === 'rebeca') {
    rebecaPath = await runRebeca(yatoPath);
  }

  if (stage === 'all' || stage === 'gideon') {
    await runGideon(yatoPath, rebecaPath);
  }

  console.log('\nMemoria opcional: node scripts/hf-ingest-learning.mjs --agent yato --text "resumo"');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
