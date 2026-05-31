#!/usr/bin/env node
/**
 * Valida agents/<id>/config.yaml: ownership de skills, secrets, runtime, executores.
 * Uso: node scripts/validate-agent-config.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadAllAgentConfigs } from './lib/parse-agent-yaml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const AGENT_ALIASES = {
  orchestrator: ['orchestrator', 'jarvis'],
  jarvis: ['orchestrator', 'jarvis'],
};

/** Secrets que só podem aparecer no config de agentes listados. */
const EXCLUSIVE_SECRETS = {
  MONGODB_URI: ['macofel'],
  MACOFEL_API_BASE: ['macofel'],
  MACOFEL_CATALOG_SECRET: ['macofel'],
  MACOFEL_CRON_BEARER: ['macofel'],
};

/** Skills que podem estar em vários agentes (policy / shared read). */
const SHARED_SKILLS_OK = new Set(['politica-seguranca']);

/** Skills operacionais que devem ter SKILL.md completo (frontmatter name:). */
const SKILLS_REQUIRE_DOC = new Set([
  'macofel-status',
  'macofel-images-sync',
  'github-aldebaran',
  'deploy-monitor',
  'vercel-status',
  'vp-pecas-health',
  'openclaw-jarvis',
]);

/** Executores registados no gateway (workflow-engine.mjs). */
const GATEWAY_EXECUTORS = new Set([
  'macofel-status',
  'macofel-images-sync',
  'github-aldebaran',
  'deploy-monitor',
  'vercel-status',
  'vp-pecas-health',
]);

/** Agentes que devem estar no daemon OpenClaw (fase operação). */
const RUNTIME_OPERATION_AGENTS = new Set([
  'orchestrator',
  'macofel',
  'vp-pecas',
  'ops',
]);

let fails = 0;
let warns = 0;

function fail(msg) {
  console.log('  [FALHA] ' + msg);
  fails++;
}

function warn(msg) {
  console.log('  [AVISO] ' + msg);
  warns++;
}

function ok(msg) {
  console.log('  [OK] ' + msg);
}

function agentMatchesManifest(agentId, manifestAgent) {
  const aliases = AGENT_ALIASES[agentId] ?? [agentId];
  return aliases.includes(manifestAgent);
}

function parseSecretsFromYaml(text) {
  const secrets = new Set();
  let inSecrets = false;
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (/^secrets:\s*$/.test(t)) {
      inSecrets = true;
      continue;
    }
    if (inSecrets && /^[a-z_]+:\s*$/.test(t) && t !== 'secrets:') {
      continue;
    }
    if (inSecrets && /^[a-z_]+:\s*$/.test(t) && !t.startsWith('-')) {
      if (t !== 'secrets:') inSecrets = false;
    }
    if (!inSecrets) continue;
    const list = t.match(/^-\s+([A-Z0-9_]+)/);
    if (list) secrets.add(list[1]);
    const bracket = t.match(/\[([^\]]+)\]/);
    if (bracket) {
      for (const s of bracket[1].split(',')) {
        secrets.add(s.trim());
      }
    }
  }
  return secrets;
}

function readJsonFile(p) {
  if (!existsSync(p)) return null;
  const buf = readFileSync(p);
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    text = buf.toString('utf16le').replace(/^\uFEFF/, '');
  } else if (buf.length > 1 && buf[1] === 0x00 && buf[0] < 0x80) {
    text = buf.toString('utf16le');
  } else {
    text = buf.toString('utf8').replace(/^\uFEFF/, '');
  }
  return JSON.parse(text);
}

function loadGatewayManifest() {
  const data = readJsonFile(resolve(root, 'gateway', 'skills', 'manifest.json'));
  return data?.skills ?? {};
}

function loadRuntimeAgents() {
  const data = readJsonFile(resolve(root, 'openclaw.json.example'));
  if (!data) return new Set();
  const list = data.agents?.list ?? [];
  return new Set(list.map((a) => a.id));
}

function skillDocPath(skillName) {
  return resolve(root, 'skills', skillName, 'SKILL.md');
}

function skillHasDoc(skillName) {
  const p = skillDocPath(skillName);
  if (!existsSync(p)) return false;
  const text = readFileSync(p, 'utf8');
  return /^---\s*\nname:\s/m.test(text) || text.length > 200;
}

console.log('=== Validacao agents/*/config.yaml ===\n');

const agentsRoot = resolve(root, 'agents');
const agents = loadAllAgentConfigs(agentsRoot);
const manifest = loadGatewayManifest();
const runtimeAgents = loadRuntimeAgents();

/** skill -> [agent ids that claim it in config.yaml] */
const skillClaimants = new Map();

for (const cfg of agents) {
  const id = cfg.id;
  const p = cfg.path ?? resolve(agentsRoot, id, 'config.yaml');

  console.log('--- ' + id + ' ---');

  if (!existsSync(p)) {
    fail(id + ' — config.yaml em falta');
    continue;
  }

  const text = readFileSync(p, 'utf8');
  const okId = new RegExp(
    '^id:\\s*' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
    'm'
  ).test(text);
  const okModel = /^\s*model:\s*.+/m.test(text);

  if (!okId) fail(id + ' — id no ficheiro nao coincide com pasta');
  if (!okModel) fail(id + ' — llm.model em falta');
  if (okId && okModel) ok(id + ' — config base OK (' + (cfg.model || '?') + ')');

  for (const skill of cfg.skills ?? []) {
    if (!skillClaimants.has(skill)) skillClaimants.set(skill, []);
    skillClaimants.get(skill).push(id);

    if (SKILLS_REQUIRE_DOC.has(skill) && !skillHasDoc(skill)) {
      fail(id + ' — skill "' + skill + '" sem SKILL.md completo em skills/');
    }

    const meta = manifest[skill];
    if (meta?.agent && !SHARED_SKILLS_OK.has(skill)) {
      if (!agentMatchesManifest(id, meta.agent)) {
        const msg =
          id +
          ' — skill "' +
          skill +
          '" no config, mas manifest owner e "' +
          meta.agent +
          '"';
        if (id === 'orchestrator') {
          warn(msg + ' (Jarvis delega; nao executa directamente)');
        } else {
          fail(msg);
        }
      }
    }
  }

  const secrets = parseSecretsFromYaml(text);
  for (const [secret, allowed] of Object.entries(EXCLUSIVE_SECRETS)) {
    if (secrets.has(secret) && !allowed.includes(id)) {
      fail(id + ' — secret exclusivo ' + secret + ' (permitido: ' + allowed.join(', ') + ')');
    }
  }

  if (RUNTIME_OPERATION_AGENTS.has(id) && !runtimeAgents.has(id)) {
    warn(id + ' — agente operacional ausente de openclaw.json.example');
  }

  if (!RUNTIME_OPERATION_AGENTS.has(id) && !runtimeAgents.has(id)) {
    ok(id + ' — inovacao/suporte: fora do runtime (esperado na fase A)');
  }

  for (const skill of cfg.skills ?? []) {
    if (GATEWAY_EXECUTORS.has(skill) && manifest[skill]) {
      ok('executor gateway registado: ' + skill);
    } else if (
      skill.startsWith('innovation-') ||
      skill === 'data-schema' ||
      skill === 'vercel-status'
    ) {
      warn(skill + ' — sem executor gateway (EC2/HF/script local)');
    }
  }

  console.log('');
}

console.log('=== Skills partilhadas entre agentes ===\n');
for (const [skill, claimants] of skillClaimants) {
  if (SHARED_SKILLS_OK.has(skill)) continue;
  const unique = [...new Set(claimants)];
  if (unique.length > 1) {
    warn(
      'skill "' +
        skill +
        '" em varios configs: ' +
        unique.join(', ') +
        ' — preferir owner unico no manifest (ver MATRIZ-AGENTE-FERRAMENTAS.md)'
    );
  }
}

console.log('\n=== Skills no manifest sem SKILL.md operacional ===\n');
for (const name of Object.keys(manifest)) {
  if (SHARED_SKILLS_OK.has(name) || name === 'help') continue;
  if (SKILLS_REQUIRE_DOC.has(name) && !skillHasDoc(name)) {
    fail('manifest skill "' + name + '" sem SKILL.md em skills/');
  }
}

console.log(
  fails
    ? '\n' + fails + ' falha(s), ' + warns + ' aviso(s).\n'
    : '\nConfigs OK (' + agents.length + ' agentes), ' + warns + ' aviso(s).\n'
);
process.exitCode = fails ? 1 : 0;
