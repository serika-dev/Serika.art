/**
 * Postgres index + sequence sync (direct, non-blocking).
 *
 * Creates the performance-critical indexes CONCURRENTLY (no write lock on the
 * live table) with statement_timeout disabled, then resyncs sequences/counters.
 *
 * Usage: npx tsx scripts/sync-postgres.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

function loadEnv() {
  try {
    const content = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join('=').replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    console.log('Could not load .env.local, using existing env vars');
  }
}

loadEnv();

// CONCURRENTLY indexes cannot run inside a transaction block; a single Client
// with autocommit runs each statement standalone.
const indexes: { label: string; sql: string; requires?: string }[] = [
  {
    label: 'idx_images_danbooru_id (import dedupe)',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_danbooru_id ON images ((metadata->>'danbooruId'))`,
  },
  {
    label: 'idx_tags_name_trgm (tag search)',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_name_trgm ON tags USING gin (name gin_trgm_ops)`,
    requires: 'pg_trgm',
  },
  {
    label: 'idx_images_description_trgm (search)',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_description_trgm ON images USING gin (description gin_trgm_ops)`,
    requires: 'pg_trgm',
  },
  {
    label: 'idx_images_username_trgm (search)',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_username_trgm ON images USING gin (username gin_trgm_ops)`,
    requires: 'pg_trgm',
  },
];

const sequences = [
  { table: 'tags', column: 'id', seq: 'tags_id_seq' },
  { table: 'images', column: 'id', seq: 'images_id_seq' },
  { table: 'votes', column: 'id', seq: 'votes_id_seq' },
  { table: 'favorites', column: 'id', seq: 'favorites_id_seq' },
  { table: 'comments', column: 'id', seq: 'comments_id_seq' },
  { table: 'artists', column: 'id', seq: 'artists_id_seq' },
  { table: 'artist_claims', column: 'id', seq: 'artist_claims_id_seq' },
  { table: 'artist_reviews', column: 'id', seq: 'artist_reviews_id_seq' },
  { table: 'artist_wikis', column: 'id', seq: 'artist_wikis_id_seq' },
  { table: 'api_keys', column: 'id', seq: 'api_keys_id_seq' },
  { table: 'import_jobs', column: 'id', seq: 'import_jobs_id_seq' },
  { table: 'dmca_requests', column: 'id', seq: 'dmca_requests_id_seq' },
  { table: 'moderation_logs', column: 'id', seq: 'moderation_logs_id_seq' },
];

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  await client.query('SET statement_timeout = 0');

  let trgmReady = false;
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    trgmReady = true;
    console.log('[SYNC] pg_trgm ready ✓');
  } catch (e: any) {
    console.warn('[SYNC] pg_trgm unavailable, skipping trigram indexes:', e?.message || e);
  }

  for (const idx of indexes) {
    if (idx.requires === 'pg_trgm' && !trgmReady) continue;
    process.stdout.write(`[SYNC] Building ${idx.label} ... `);
    const t = Date.now();
    try {
      await client.query(idx.sql);
      console.log(`done (${((Date.now() - t) / 1000).toFixed(1)}s)`);
    } catch (e: any) {
      console.log(`FAILED: ${e?.message || e}`);
    }
  }

  console.log('[SYNC] Resyncing sequences + counters...');
  for (const { table, column, seq } of sequences) {
    try {
      await client.query(
        `SELECT setval($1, COALESCE((SELECT MAX(${column}) FROM ${table}), 1))`,
        [seq]
      );
    } catch (e: any) {
      console.warn(`[SYNC]   ${seq}: ${e?.message || e}`);
    }
  }
  await client.query(`
    INSERT INTO counters (name, value)
    VALUES ('imageSequentialId', COALESCE((SELECT MAX(sequential_id) FROM images), 1))
    ON CONFLICT (name) DO UPDATE SET value = GREATEST(counters.value, EXCLUDED.value)
  `);

  console.log('[SYNC] Done ✓');
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('[SYNC] Failed:', err);
  process.exit(1);
});
