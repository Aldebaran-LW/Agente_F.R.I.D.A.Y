#!/usr/bin/env node
/**
 * Pipeline Sophia → Rebeca (opcional) → Senku → recomendação Hefestos
 * Uso: node scripts/innovation-pipeline.mjs --topic "tema" [--dry-run] [--stage all|sophia|senku]
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadAllAgentConfigs } from './lib/parse-agent-yaml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

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

const topic = argValue('--topic') || 'ferramentas IA gratuitas para OpenClaw';
const dryRun = process.argv.includes('--dry-run');
const stage = argValue('--stage') || 'all';
const SENKU_THRESHOLD = Number(process.env.SENKU_THRESHOLD || 70);

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
  const c = configs.find((a) => a.id === agentId);
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
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function yamlScalar(v) {
  if (v == null) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
  return JSON.stringify(String(v));
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
  const pesquisaId = nextId('sophia');
  const outPath = join(todayDir(), `${pesquisaId}.yaml`);
  const system = `Tu es Sophia, agente de pesquisa OpenClaw. Responde em portugues.
Gera UM unico bloco YAML valido (sem markdown) com: pesquisa_id, gerado_em, agente, topico, ferramenta (nome, categoria, link, caso_uso, retorno_estimado: baixa|media|alta, fonte), notas, proximo_passo.
Fontes: HF Hub, GitHub Trending, Papers with Code, Product Hunt, Reddit tech.`;

  let body;
  if (dryRun || !process.env.OPENROUTER_API_KEY) {
    body = {
      pesquisa_id: pesquisaId,
      gerado_em: new Date().toISOString(),
      agente: 'sophia',
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
      proximo_passo: 'senku',
    };
  } else {
    const raw = await callOpenRouter('sophia', system, `Topico: ${topic}`);
    try {
      const cleaned = raw.replace(/^```ya?ml?\n?/i, '').replace(/\n?```$/i, '');
      body = { pesquisa_id: pesquisaId, parse_llm: true, raw: cleaned };
    } catch {
      body = { pesquisa_id: pesquisaId, agente: 'sophia', topico: topic, raw_llm: raw };
    }
  }

  writeYaml(outPath, body);
  console.log('[Sophia] ->', outPath);
  return { outPath, body, pesquisaId };
}

async function runRebeca(sophiaPath) {
  const designId = nextId('rebeca');
  const outPath = join(todayDir(), `${designId}.yaml`);
  const sophiaText = readFileSync(sophiaPath, 'utf8').slice(0, 3000);
  const system = `Tu es Rebeca, design para dashboards /office e /forge OpenClaw. Responde em portugues com brief YAML: design_id, paleta, componentes[], referencias_visuais[], notas.`;

  let body;
  if (dryRun || !process.env.OPENROUTER_API_KEY) {
    body = {
      design_id: designId,
      baseado_em: sophiaPath,
      paleta: ['#0b0f14', '#6eb5ff', '#3dd68c'],
      componentes: ['cards agentes', 'status forge'],
      notas: 'dry-run',
    };
  } else {
    const raw = await callOpenRouter('rebeca', system, `Pesquisa Sophia:\n${sophiaText}`);
    body = { design_id: designId, raw_llm: raw };
  }
  writeYaml(outPath, body);
  console.log('[Rebeca] ->', outPath);
  return outPath;
}

async function runSenku(sophiaPath, rebecaPath) {
  const senkuId = nextId('senku');
  const outPath = join(todayDir(), `${senkuId}.yaml`);
  const context = readFileSync(sophiaPath, 'utf8').slice(0, 4000)
    + (rebecaPath && existsSync(rebecaPath) ? '\n' + readFileSync(rebecaPath, 'utf8').slice(0, 2000) : '');

  const system = `Tu es Senku. Avalia viabilidade com 4 subscores 0-100: custo_implementacao, retorno_lucrativo, compatibilidade_stack, manutenibilidade.
Pesos: 30%, 35%, 20%, 15%. Calcula viabilidade_score final.
Responde YAML: senku_id, pesquisa_id, subscores{}, viabilidade_score, recomendacao (hefestos|arquivar|mais_pesquisa), justificativa.`;

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
      senku_id: senkuId,
      subscores: sub,
      viabilidade_score: score,
      recomendacao: score >= SENKU_THRESHOLD ? 'hefestos' : 'arquivar',
      justificativa: 'dry-run com subscores exemplo',
      threshold: SENKU_THRESHOLD,
    };
  } else {
    const raw = await callOpenRouter('senku', system, context);
    body = { senku_id: senkuId, raw_llm: raw };
    const m = raw.match(/viabilidade_score:\s*(\d+)/i);
    if (m) body.viabilidade_score = Number(m[1]);
  }

  writeYaml(outPath, body);
  console.log('[Senku] ->', outPath, 'score=', body.viabilidade_score ?? '?');

  if ((body.viabilidade_score ?? 0) >= SENKU_THRESHOLD) {
    console.log('[OK] Elegivel para Hefestos — requer aprovacao humana para producao.');
  } else {
    console.log('[--] Abaixo do threshold', SENKU_THRESHOLD, '— arquivar ou mais pesquisa.');
  }
  return outPath;
}

async function main() {
  console.log('=== Innovation pipeline ===');
  console.log('Topico:', topic);
  console.log('Stage:', stage, dryRun ? '(dry-run)' : '');

  let sophiaPath;
  if (stage === 'all' || stage === 'sophia') {
    const s = await runSophia();
    sophiaPath = s.outPath;
  } else {
    const dir = todayDir();
    const files = readdirSync(dir).filter((f) => f.startsWith('sophia_')).sort();
    if (!files.length) {
      console.error('Sem ficheiro sophia_* em', dir);
      process.exit(1);
    }
    sophiaPath = join(dir, files[files.length - 1]);
  }

  let rebecaPath;
  if (stage === 'all' || stage === 'rebeca') {
    rebecaPath = await runRebeca(sophiaPath);
  }

  if (stage === 'all' || stage === 'senku') {
    await runSenku(sophiaPath, rebecaPath);
  }

  console.log('\nMemoria opcional: node scripts/hf-ingest-learning.mjs --agent sophia --text "resumo"');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
