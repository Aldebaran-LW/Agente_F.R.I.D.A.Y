#!/usr/bin/env node
/**
 * Gideon — predição e cenários a partir da análise Senku → predictions/
 * Uso: node scripts/gideon-predict.mjs --topic "ai agents" [--file path/senku.yaml] [--json]
 */
import { existsSync } from 'fs';
import { join } from 'path';
import {
  todayDir,
  nextEntryId,
  writeJsonReport,
  writeYamlEntry,
  findLatestOne,
  loadJson,
} from './lib/innovation-io.mjs';
import { buildGideonPrediction, THRESHOLD_HEFESTOS } from './lib/gideon-forecast.mjs';
import { loadEnv } from './lib/load-env.mjs';

loadEnv();

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function main() {
  const topic = arg('--topic') || 'openclaw';
  const asJson = process.argv.includes('--json');
  const fileArg = arg('--file');
  const dir = todayDir();

  let senkuPath = fileArg;
  if (!senkuPath || !existsSync(senkuPath)) {
    senkuPath = findLatestOne(dir, 'senku', '.json') || findLatestOne(dir, 'senku', '.yaml');
  }
  if (!senkuPath) {
    console.error('Sem análise Senku. Correr: node scripts/senku-process.mjs --topic "' + topic + '"');
    process.exit(1);
  }

  if (!senkuPath.endsWith('.json')) {
    const jsonAlt = findLatestOne(dir, 'senku', '.json');
    if (jsonAlt) senkuPath = jsonAlt;
  }
  const senkuBody = loadJson(senkuPath);
  const forecast = buildGideonPrediction(senkuBody);
  const gideonId = nextEntryId('gideon');
  const body = {
    gideon_id: gideonId,
    senku_id: senkuBody.senku_id,
    gerado_em: new Date().toISOString(),
    agente: 'gideon',
    topico: senkuBody.topico || topic,
    ...forecast,
    dataset_path: 'predictions/',
    proximo_passo: forecast.recomendacao === 'hefestos' ? 'hefestos' : forecast.recomendacao,
  };

  const jsonPath = writeJsonReport('gideon', topic, body);
  const yamlPath = join(dir, `${gideonId}.yaml`);
  writeYamlEntry(body, yamlPath, 'gideon');

  if (asJson) {
    console.log(JSON.stringify({ ...body, saved_json: jsonPath, saved_yaml: yamlPath }, null, 2));
  } else {
    console.log(`Gideon: confiança=${body.confianca_score} recomendação=${body.recomendacao}`);
    console.log(`JSON: ${jsonPath}`);
    console.log(`YAML: ${yamlPath}`);
    if (body.recomendacao === 'hefestos') {
      console.log(`\n[OK] Elegível Hefestos (≥${THRESHOLD_HEFESTOS}) — requer sim/confirmar do Lucas.`);
    } else {
      console.log(`\n[--] ${body.recomendacao} (threshold ${THRESHOLD_HEFESTOS}).`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
