/**
 * Postgres schema + index + sequence sync.
 *
 * Applies the schema (tables + all indexes, including the trigram and
 * danbooru-id indexes) and resynchronizes serial sequences / counters.
 *
 * Usage: npx tsx scripts/sync-postgres.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';

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

async function main() {
  // Import after env is loaded (lib/db throws if POSTGRES_URL is missing).
  const db = await import('../lib/db');
  console.log('[SYNC] Ensuring schema + indexes...');
  await db.ensureSchema();
  console.log('[SYNC] Resyncing sequences + counters...');
  await db.syncSequencesAndCounters();
  console.log('[SYNC] Done ✓');
  await db.getPool().end();
  const importPool = db.getImportPool();
  await importPool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('[SYNC] Failed:', err);
  process.exit(1);
});
