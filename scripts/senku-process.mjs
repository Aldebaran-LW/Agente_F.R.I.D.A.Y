#!/usr/bin/env node
/**
 * Senku — análise e correlação (conhecimento + mercado) → analysis/
 * Uso: node scripts/senku-process.mjs --topic "ai agents" [--json] [--yaml]
 */
import { join } from 'path';
import {
  todayDir,
  nextEntryId,
  writeJsonReport,
  writeYamlEntry,
  findLatestFiles,
  slugTopic,
} from './lib/innovation-io.mjs';
import { buildSenkuAnalysis, extractItemsFromPaths } from './lib/senku-correlate.mjs';
import { loadEnv } from './lib/load-env.mjs';

loadEnv();

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function main() {
  const topic = arg('--topic') || 'openclaw';
  const asJson = process.argv.includes('--json');
  const writeYaml = process.argv.includes('--yaml') || !asJson;
  const dir = todayDir();
  const slug = slugTopic(topic);

  const sophiaFiles = findLatestFiles(dir, 'sophia');
  const yatoFiles = findLatestFiles(dir, 'yato');
  const paths = [...sophiaFiles.slice(-3), ...yatoFiles.slice(-2)];
  const { knowledge, market } = extractItemsFromPaths(paths);

  const analysis = buildSenkuAnalysis(topic, knowledge, market);
  const senkuId = nextEntryId('senku');
  const body = {
    senku_id: senkuId,
    gerado_em: new Date().toISOString(),
    agente: 'senku',
    ...analysis,
    dataset_path: 'analysis/',
    fontes_lidas: paths.map((p) => p.split(/[/\\]/).pop()),
  };

  const jsonPath = writeJsonReport('senku', topic, body);
  let yamlPath = null;
  if (writeYaml) {
    yamlPath = join(dir, `${senkuId}.yaml`);
    writeYamlEntry(body, yamlPath, 'senku');
  }

  if (asJson) {
    console.log(JSON.stringify({ ...body, saved_json: jsonPath, saved_yaml: yamlPath }, null, 2));
  } else {
    console.log(`Senku: ${analysis.correlacoes.length} correlações, ${analysis.solicitacoes_pesquisa.length} pedidos de pesquisa.`);
    console.log(`JSON: ${jsonPath}`);
    if (yamlPath) console.log(`YAML: ${yamlPath}`);
    for (const s of analysis.solicitacoes_pesquisa) {
      console.log(`→ Pedir ${s.agente}: ${s.pedido}`);
    }
    console.log('\nPróximo: node scripts/gideon-predict.mjs --topic "' + topic + '"');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
