import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

function parseAgentYaml(text) {
  const cfg = { skills: [], fallbacks: [] };
  let inSkills = false;
  let inFallbacks = false;
  let inLlm = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (/^[a-z_]+:\s*$/.test(t)) {
      inSkills = t === 'skills:';
      inFallbacks = t === 'fallbacks:';
      inLlm = t === 'llm:';
      continue;
    }
    if (inSkills && t.startsWith('- ')) { cfg.skills.push(t.slice(2).trim()); continue; }
    if (inFallbacks && t.startsWith('- ')) { cfg.fallbacks.push(t.slice(2).trim()); continue; }
    const m = t.match(/^([a-z_]+):\s*(.+)$/i);
    if (!m) continue;
    const [, key, valRaw] = m;
    const val = valRaw.trim().replace(/^["']|["']$/g, '');
    if (inLlm) {
      if (key === 'fallbacks' && val === '[]') {
        cfg.fallbacks = [];
        continue;
      }
      cfg[key] = val;
    } else cfg[key] = val;
  }
  return cfg;
}

export function modelRef(cfg) {
  const provider = cfg.provider || 'ollama';
  const model = cfg.model || 'smollm2:360m';
  if (provider === 'ollama') return `ollama/${model}`;
  if (provider === 'google') return model.startsWith('google/') ? model : `google/${model}`;
  if (provider === 'deepseek') {
    if (model.startsWith('deepseek/')) return model;
    return `deepseek/${model}`;
  }
  if (provider === 'huggingface') {
    if (model.startsWith('huggingface/')) return model;
    return `huggingface/${model}`;
  }
  if (provider === 'groq') {
    if (model.startsWith('groq/')) return model;
    return `groq/${model}`;
  }
  if (provider === 'infron') {
    if (model.startsWith('infron/')) return model;
    return `infron/${model}`;
  }
  if (provider === 'kilo') return model;
  return model;
}

export function loadAllAgentConfigs(agentsRoot) {
  const out = [];
  if (!existsSync(agentsRoot)) return out;
  for (const dir of readdirSync(agentsRoot, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_')) continue;
    const p = join(agentsRoot, dir.name, 'config.yaml');
    if (!existsSync(p)) continue;
    const cfg = parseAgentYaml(readFileSync(p, 'utf8'));
    cfg.id = cfg.id || dir.name;
    cfg.path = p;
    out.push(cfg);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export { parseAgentYaml };