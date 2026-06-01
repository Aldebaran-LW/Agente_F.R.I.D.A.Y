#!/usr/bin/env node
/**
 * Sophia — pesquisa de conhecimento (HF Spaces).
 * Uso: node scripts/sophia-search-hf.mjs --topic "ai agents" [--limit 15] [--yaml] [--json]
 */
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { searchHfSpaces } from './lib/hf-spaces-search.mjs';
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
  const topic = arg('--topic') || arg('--query') || 'openclaw agents';
  const limit = Number(arg('--limit')) || 15;
  const asJson = process.argv.includes('--json');
  const writeYaml = process.argv.includes('--yaml');

  const hits = await searchHfSpaces(topic, limit);
  const vetted = hits.filter((h) => h.link_ok);
  const top = vetted.slice(0, 5).map((h) => ({
    id: h.id,
    nome: h.id,
    link: h.link,
    likes: h.likes,
    sdk: h.sdk,
    stage: h.stage,
    descricao: h.descricao,
  }));

  const report = {
    ok: true,
    source: 'sophia-search-hf',
    agente: 'sophia',
    topico: topic,
    gerado_em: new Date().toISOString(),
    total: hits.length,
    vetted: vetted.length,
    spaces: hits,
    dataset_path: 'knowledge/',
    proximo_passo: 'senku',
  };

  const jsonPath = writeJsonReport('sophia_hf', topic, report);
  report.saved_json = jsonPath;

  const yamlPaths = [];
  if (writeYaml && top.length) {
    for (const item of top) {
      const entry = toPesquisaEntry('sophia', item, { fonte: 'HF Hub', topico: topic });
      const yp = join(todayDir(), `${entry.pesquisa_id}.yaml`);
      writeYamlEntry(entry, yp, 'sophia');
      yamlPaths.push(yp);
    }
    report.yaml_files = yamlPaths;
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Sophia [HF]: ${vetted.length}/${hits.length} spaces.`);
    console.log(`JSON: ${jsonPath}`);
    if (yamlPaths.length) for (const p of yamlPaths) console.log(`  YAML: ${p}`);
    console.log('\nPróximo: node scripts/senku-process.mjs --topic "' + topic + '"');
  }
  process.exit(vetted.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
