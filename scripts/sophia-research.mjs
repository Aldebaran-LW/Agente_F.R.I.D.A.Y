#!/usr/bin/env node
/**
 * Sophia — pesquisa de conhecimento combinada (HF + GitHub).
 */
import { searchHfSpaces } from './lib/hf-spaces-search.mjs';
import { searchGithubRepos } from './lib/yato-github-search.mjs';
import { writeJsonReport } from './lib/innovation-io.mjs';
import { loadEnv } from './lib/load-env.mjs';

loadEnv();

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const topic = arg('--topic') || 'openclaw';

async function main() {
  const hits = await searchHfSpaces(topic, 10);
  const gh = await searchGithubRepos(topic, 8);
  const combined = {
    ok: true,
    source: 'sophia-research',
    agente: 'sophia',
    topico: topic,
    gerado_em: new Date().toISOString(),
    hf: { spaces: hits.filter((h) => h.link_ok), total: hits.length },
    github: gh,
    dataset_path: 'knowledge/',
    proximo_passo: 'yato',
  };
  const path = writeJsonReport('sophia_research', topic, combined);
  console.log('Sophia [combinado] ->', path);
  if (process.argv.includes('--yaml')) {
    const { spawnSync } = await import('child_process');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const dir = resolve(dirname(fileURLToPath(import.meta.url)));
    spawnSync(process.execPath, [resolve(dir, 'sophia-search-hf.mjs'), '--topic', topic, '--yaml'], { stdio: 'inherit' });
    spawnSync(process.execPath, [resolve(dir, 'sophia-search-github.mjs'), '--topic', topic, '--yaml'], { stdio: 'inherit' });
  }
  console.log('Próximo: node scripts/yato-market-search.mjs --topic "' + topic + '"');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
