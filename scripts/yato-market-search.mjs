#!/usr/bin/env node
/**
 * Yato — pesquisa de mercado (tendências, adoção, concorrência via sinais públicos).
 * Uso: node scripts/yato-market-search.mjs --topic "ai agents b2b" [--limit 10] [--yaml] [--json]
 */
import { join } from 'path';
import {
  toPesquisaEntry,
  writeJsonReport,
  writeYamlEntry,
  todayDir,
} from './lib/innovation-io.mjs';
import { searchMarketSignals } from './lib/yato-market-search.mjs';
import { loadEnv } from './lib/load-env.mjs';

loadEnv();

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function main() {
  const topic = arg('--topic') || arg('--query') || 'openclaw saas';
  const limit = Number(arg('--limit')) || 10;
  const asJson = process.argv.includes('--json');
  const writeYaml = process.argv.includes('--yaml');

  const signals = await searchMarketSignals(topic, limit);
  const report = {
    ok: true,
    source: 'yato-market-search',
    agente: 'yato',
    topico: topic,
    gerado_em: new Date().toISOString(),
    total: signals.length,
    sinais_mercado: signals,
    fontes_planeadas: ['Product Hunt', 'G2', 'Google Trends', 'Crunchbase'],
    dataset_path: 'market/',
    proximo_passo: 'senku',
  };

  const jsonPath = writeJsonReport('yato_market', topic, report);
  const yamlPaths = [];
  if (writeYaml && signals.length) {
    for (const item of signals.slice(0, 5)) {
      const entry = toPesquisaEntry('yato', item, {
        fonte: 'Mercado (proxy GitHub)',
        topico: topic,
        tipo: 'mercado',
      });
      const yp = join(todayDir(), `${entry.pesquisa_id}.yaml`);
      writeYamlEntry(entry, yp, 'yato');
      yamlPaths.push(yp);
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ ...report, saved_json: jsonPath, yaml_files: yamlPaths }, null, 2));
  } else {
    console.log(`Yato [mercado]: ${signals.length} sinais.`);
    console.log(`JSON: ${jsonPath}`);
    for (const s of signals.slice(0, 5)) {
      console.log(`• ${s.nome || s.id} ★${s.stars ?? 0} — ${s.notas?.slice(0, 50) || ''}`);
    }
    console.log('\nPróximo: node scripts/senku-process.mjs --topic "' + topic + '"');
  }
  process.exit(signals.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
