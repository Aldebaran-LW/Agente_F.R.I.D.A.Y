import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

/** Sincronizar com buildExecutors() em workflow-engine.mjs */
export const GATEWAY_LOCAL_EXECUTORS = new Set([
  'macofel-status',
  'macofel-images-sync',
  'github-aldebaran',
  'deploy-monitor',
  'vercel-status',
  'vp-pecas-health',
  'security-audit',
  'innovation-monitor',
  'innovation-design',
  'innovation-test',
  'ecosystem-watch',
  'schedule-whatsapp',
  'whatsapp-contacts',
  'whatsapp-send-contact',
  'user-preferences',
  'proposals-pipeline',
]);

/** Skills que delegam HF/EC2 — sem executor local no gateway. */
const ORCHESTRATE_ONLY = new Set([
  'innovation-knowledge',
  'innovation-market',
  'innovation-analysis',
  'innovation-forecast',
  'innovation-research',
  'innovation-viability',
  'innovation-build',
]);

/** Skills com executor só na EC2 (scripts longos). */
const EC2_ONLY = new Set(['cursor-cloud-agent']);

function loadManifest() {
  const p = join(__dir, '../skills/manifest.json');
  const raw = readFileSync(p, 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

function validateManifestExecutors(manifestSkills) {
  const checks = [];
  let fails = 0;

  for (const [skill, meta] of Object.entries(manifestSkills)) {
    if (meta.mode === 'policy' || skill === 'help' || skill === 'openclaw-jarvis') {
      checks.push({ name: `skip:${skill}`, ok: true, detail: 'policy/static' });
      continue;
    }
    const hasLocal = GATEWAY_LOCAL_EXECUTORS.has(skill);
    const orchestrates = ORCHESTRATE_ONLY.has(skill);
    const ec2Only = EC2_ONLY.has(skill);
    if (hasLocal || orchestrates || ec2Only) {
      checks.push({
        name: `executor:${skill}`,
        ok: true,
        detail: hasLocal ? 'gateway' : ec2Only ? 'ec2' : 'orchestrate',
      });
    } else {
      checks.push({
        name: `executor:${skill}`,
        ok: false,
        detail: 'sem executor local nem orchestrate',
      });
      fails++;
    }
  }

  return { checks, fails };
}

function formatReply({ ok, checks, fails, mode }) {
  const failed = checks.filter((c) => !c.ok);
  const lines = [
    ok ? 'Ícaro: validacao OK.' : `Ícaro: ${fails} falha(s).`,
    `Modo: ${mode} (${checks.length} checks).`,
  ];
  if (failed.length) {
    lines.push('', 'Falhas:');
    for (const f of failed.slice(0, 8)) {
      lines.push(`• ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
    }
    if (failed.length > 8) lines.push(`… +${failed.length - 8} mais`);
  }
  lines.push('', 'Suite completa (local): node scripts/icaro-test-suite.mjs');
  return lines.join('\n').slice(0, 1500);
}

/**
 * Executor gateway — skill innovation-test (Ícaro).
 * Valida manifest vs executores registados (funciona na Vercel).
 */
export async function runInnovationTest(opts = {}) {
  const mode = opts.mode || 'gateway-lite';
  const manifest = loadManifest();
  const { checks, fails } = validateManifestExecutors(manifest.skills ?? {});
  const ok = fails === 0;

  return {
    ok,
    agent: 'icaro',
    skill: 'innovation-test',
    mode,
    checks,
    fails,
    warnings: 0,
    reply: formatReply({ ok, checks, fails, mode }),
  };
}
