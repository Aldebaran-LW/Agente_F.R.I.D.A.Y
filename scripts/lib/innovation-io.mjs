/**
 * I/O partilhado — pipeline inovação (Sophia → Yato → Senku → Gideon)
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');

/** @type {Record<string, string>} */
export const PROXIMO_PASSO = {
  sophia: 'senku',
  yato: 'senku',
  rebeca: 'senku',
  senku: 'gideon',
  gideon: 'hefestos',
};

/** Prefixos de ficheiro por agente (inclui legado). */
export const FILE_PREFIXES = {
  sophia: ['sophia_', 'yato_hf_', 'yato_github_', 'yato_research_'],
  yato: ['yato_market_', 'yato_mercado_'],
  senku: ['senku_'],
  gideon: ['gideon_'],
  rebeca: ['rebeca_'],
};

export function getRoot() {
  return root;
}

export function todayDir() {
  const day = new Date().toISOString().slice(0, 10);
  const dir = resolve(root, 'data', 'innovation', day);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function slugTopic(topic) {
  return String(topic)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 40);
}

export function nextEntryId(agent) {
  const dir = todayDir();
  const prefix = `${agent}_`;
  const existing = readdirSync(dir).filter(
    (f) => f.startsWith(prefix) && (f.endsWith('.yaml') || f.endsWith('.json')),
  );
  const n = String(existing.length + 1).padStart(3, '0');
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${agent}_${stamp}_${n}`;
}

/** @param {'sophia'|'yato'} agent */
export function toPesquisaEntry(agent, item, { fonte, topico, tipo = 'ferramenta' }) {
  const stars = item.stars ?? 0;
  const likes = item.likes ?? 0;
  const retorno =
    stars > 500 || likes > 100 ? 'alta' : stars > 50 || likes > 20 ? 'media' : 'baixa';
  const casoUso =
    agent === 'yato'
      ? item.descricao || `Sinal de mercado / demanda — ${topico}`
      : item.descricao || `Conhecimento / ferramenta — ${topico}`;
  return {
    pesquisa_id: nextEntryId(agent),
    gerado_em: new Date().toISOString(),
    agente: agent,
    tipo,
    topico,
    ferramenta: {
      nome: item.nome || item.id,
      categoria:
        agent === 'yato'
          ? ['mercado', fonte.toLowerCase().replace(/\s+/g, '_')]
          : fonte === 'HF Hub'
            ? ['conhecimento', 'hf', 'space']
            : ['conhecimento', 'repo', 'github'],
      link: item.link,
      caso_uso: casoUso,
      retorno_estimado: retorno,
      fonte,
    },
    notas: item.sdk ? `SDK: ${item.sdk}, stage: ${item.stage || '?'}` : item.notas || '',
    proximo_passo: PROXIMO_PASSO[agent] || 'senku',
    dataset_path: agent === 'yato' ? 'market/' : 'knowledge/',
  };
}

export function writeJsonReport(prefix, topic, payload) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(todayDir(), `${prefix}_${slugTopic(topic)}_${stamp}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
  return path;
}

export function writeYamlEntry(entry, path, commentAgent) {
  const agent = commentAgent || entry.agente || 'innovation';
  const lines = [`# gerado por ${agent} (pipeline inovação)`];
  const esc = (v) => {
    if (v === null || v === undefined) return '""';
    const s = String(v);
    if (/[:#\n]/.test(s) || s.includes('"')) return JSON.stringify(s);
    return s;
  };
  for (const [k, v] of Object.entries(entry)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(k === 'ferramenta' ? v : null)) {
      if (k === 'ferramenta' || k === 'subscores' || k === 'correlacoes') {
        lines.push(`${k}:`);
        for (const [k2, v2] of Object.entries(v)) {
          if (Array.isArray(v2)) {
            lines.push(`  ${k2}: [${v2.map((x) => esc(x)).join(', ')}]`);
          } else {
            lines.push(`  ${k2}: ${esc(v2)}`);
          }
        }
      } else {
        lines.push(`${k}: ${esc(JSON.stringify(v))}`);
      }
    } else if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const row of v) {
        if (typeof row === 'object') {
          lines.push(`  - ${esc(JSON.stringify(row))}`);
        } else {
          lines.push(`  - ${esc(row)}`);
        }
      }
    } else {
      lines.push(`${k}: ${esc(v)}`);
    }
  }
  writeFileSync(path, lines.join('\n') + '\n', 'utf8');
}

/** Último JSON/YAML por prefixos (ordem alfabética = mais recente se timestamp no nome). */
export function findLatestFiles(dir, agent, { ext = '.json' } = {}) {
  const prefixes = FILE_PREFIXES[agent] || [`${agent}_`];
  const out = [];
  if (!existsSync(dir)) return out;
  for (const prefix of prefixes) {
    for (const f of readdirSync(dir)) {
      if (f.startsWith(prefix) && f.endsWith(ext)) out.push(join(dir, f));
    }
  }
  return out.sort();
}

export function findLatestOne(dir, agent, ext = '.yaml') {
  const files = findLatestFiles(dir, agent, { ext });
  return files.length ? files[files.length - 1] : null;
}

export function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
