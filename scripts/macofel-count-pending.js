#!/usr/bin/env node
import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const p = resolve(__dirname, '..', '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}

loadEnv();
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'macofel';

if (!uri) {
  console.log(JSON.stringify({ ok: false, error: 'MONGODB_URI missing' }));
  process.exit(1);
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const col = client.db(dbName).collection('products');
  const [pending_review, image_sync_pending, image_sync_synced, image_sync_failed, total] =
    await Promise.all([
      col.countDocuments({ status: 'pending_review' }),
      col.countDocuments({
        $or: [
          { image_sync_status: 'pending' },
          { image_sync_status: { $exists: false } },
          { image_sync_status: null },
        ],
      }),
      col.countDocuments({ image_sync_status: 'synced' }),
      col.countDocuments({ image_sync_status: 'failed' }),
      col.countDocuments({}),
    ]);
  console.log(
    JSON.stringify({
      ok: true,
      db: dbName,
      total,
      pending_review,
      image_sync_pending,
      image_sync_synced,
      image_sync_failed,
      at: new Date().toISOString(),
    })
  );
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e.message || e) }));
  process.exit(1);
} finally {
  await client.close();
}
