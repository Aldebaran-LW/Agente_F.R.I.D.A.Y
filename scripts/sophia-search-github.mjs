#!/usr/bin/env node
/**
 * Sophia — conhecimento via GitHub Search API.
 * Uso: node scripts/sophia-search-github.mjs --topic "llm agents" [--limit 10] [--yaml] [--json]
 */
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { searchGithubRepos, searchGithubOrgRepos } from './lib/yato-github-search.mjs';
import {
  toPesquisaEntry,
  writeJsonReport,
  writeYamlEntry,
  todayDir,
} from './lib/innovation-io.mjs';
import { loadEnv } from './lib/load-env.mjs';

loadEnv();

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function main() {
  const topic = arg('--topic') || arg('--query') || 'openclaw ai';
  const limit = Number(arg('--limit')) || 10;
  const asJson = process.argv.includes('--json');
  const writeYaml = process.argv.includes('--yaml');

  const org = process.env.GITHUB_ORG || 'Aldebaran-LW';
  const [gh, orgGh] = await Promise.all([
    searchGithubRepos(topic, limit),
    searchGithubOrgRepos(org, Math.min(5, limit)),
  ]);
  const merged = [...(orgGh.items || []), ...(gh.items || [])].filter(
    (r, i, arr) => arr.findIndex((x) => x.link === r.link) === i,
  );

  const report = {
    ok: true,
    source: 'sophia-search-github',
    agente: 'sophia',
    topico: topic,
    gerado_em: new Date().toISOString(),
    total: merged.length,
    repos: merged,
    dataset_path: 'knowledge/',
    proximo_passo: 'senku',
  };

  const jsonPath = writeJsonReport('sophia_github', topic, report);
  const top = merged.slice(0, 5);
  const yamlPaths = [];
  if (writeYaml && top.length) {
    for (const item of top) {
      const entry = toPesquisaEntry('sophia', item, { fonte: 'GitHub', topico: topic });
      const yp = join(todayDir(), `${entry.pesquisa_id}.yaml`);
      writeYamlEntry(entry, yp, 'sophia');
      yamlPaths.push(yp);
    }
    report.yaml_files = yamlPaths;
  }

  if (asJson) {
    console.log(JSON.stringify({ ...report, saved_json: jsonPath }, null, 2));
  } else {
    console.log(`Sophia [GitHub]: ${merged.length} repos.`);
    console.log(`JSON: ${jsonPath}`);
    for (const r of top) console.log(`• ${r.nome || r.id} ★${r.stars ?? '?'}`);
    console.log('\nPróximo: node scripts/senku-process.mjs --topic "' + topic + '"');
  }
  process.exit(merged.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
