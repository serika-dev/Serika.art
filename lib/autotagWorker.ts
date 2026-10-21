import { getImportPool, importQuery } from '@/lib/db';
import { AutotaggerUnavailableError, UnreadableImageError, isAutotaggerConfigured } from '@/lib/autotagger';
import { autotagPost, markAutotagSkipped, MIN_TAGS } from '@/lib/autotagApply';

// Background backfill: runs the autotagger over every public post with fewer
// than MIN_TAGS tags that hasn't been autotagged yet, oldest first, and adds the
// confident predictions. Resumable (cursor in the counters table), one worker
// across all app processes (advisory lock), and paced so the tagger keeps
// headroom for people uploading. Enabled with AUTOTAG_BACKFILL=true.

const LOCK_KEY = 72419641777;
const CURSOR = 'autotagBackfillCursor';
const PROCESSED = 'autotagBackfillProcessed';
const TAGS_ADDED = 'autotagBackfillTagsAdded';
const COMPLETED_AT = 'autotagBackfillCompletedAt'; // unix seconds of the last full pass
const BATCH = 25;
const SCAN_WINDOW = 20000; // image ids examined per query
const PAUSE_BETWEEN_POSTS_MS = parseInt(process.env.AUTOTAG_BACKFILL_DELAY_MS || '500', 10);
const RESCAN_AFTER_MS = 6 * 60 * 60 * 1000; // reached the end: look again in 6h
const LOCK_RETRY_MS = 5 * 60 * 1000;
const TAGGER_DOWN_RETRY_MS = 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let started = false;

export function startAutotagWorker(): void {
  if (started || !isAutotaggerConfigured()) return;
  started = true;
  run().catch((err) => console.error('[autotag-backfill] Worker stopped:', err));
}

async function bump(name: string, by: number) {
  await importQuery(
    `INSERT INTO counters (name, value) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET value = counters.value + EXCLUDED.value`,
    [name, by]
  );
}

async function setCursor(value: number) {
  await importQuery(
    `INSERT INTO counters (name, value) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
    [CURSOR, value]
  );
}

export async function getBackfillStatus() {
  const res = await importQuery<{ name: string; value: number }>(
    `SELECT name, value FROM counters WHERE name = ANY($1::text[])`,
    [[CURSOR, PROCESSED, TAGS_ADDED, COMPLETED_AT]]
  );
  const values = Object.fromEntries(res.rows.map((r) => [r.name, Number(r.value)]));
  const max = await importQuery(`SELECT COALESCE(MAX(id), 0) AS max FROM images`);
  return {
    enabled: process.env.AUTOTAG_BACKFILL === 'true',
    cursor: values[CURSOR] ?? 0,
    maxImageId: Number(max.rows[0].max),
    processed: values[PROCESSED] ?? 0,
    tagsAdded: values[TAGS_ADDED] ?? 0,
    lastPassCompletedAt: values[COMPLETED_AT] ? new Date(values[COMPLETED_AT] * 1000).toISOString() : null,
  };
}

async function run() {
  // Hold the lock on a dedicated connection for the worker's lifetime.
  for (;;) {
    const client = await getImportPool().connect();
    let locked = false;
    try {
      locked = (await client.query(`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS ok`)).rows[0].ok;
      if (locked) {
        console.log('[autotag-backfill] Started');
        await loop();
      }
    } catch (err) {
      console.error('[autotag-backfill] Error, restarting soon:', err);
    } finally {
      if (locked) await client.query(`SELECT pg_advisory_unlock(${LOCK_KEY})`).catch(() => {});
      client.release();
    }
    await sleep(LOCK_RETRY_MS);
  }
}

async function loop() {
  for (;;) {
    const cursorRes = await importQuery(`SELECT value FROM counters WHERE name = $1`, [CURSOR]);
    const cursor = Number(cursorRes.rows[0]?.value ?? 0);

    // Scan a bounded id window per query so a stretch of well-tagged posts
    // can never turn one query into a full-table scan.
    const batch = await importQuery<{ id: number; sequential_id: number; url: string }>(
      `SELECT i.id, i.sequential_id, i.url
       FROM images i
       WHERE i.id > $1 AND i.id <= $1 + $4
         AND i.deleted = FALSE AND i.unlisted = FALSE
         AND NOT (COALESCE(i.metadata, '{}'::jsonb) ? 'autotaggedAt')
         AND (SELECT COUNT(*) FROM image_tags it WHERE it.image_id = i.id) < $2
       ORDER BY i.id
       LIMIT $3`,
      [cursor, MIN_TAGS, BATCH, SCAN_WINDOW]
    );

    if (batch.rows.length === 0) {
      const max = await importQuery(`SELECT COALESCE(MAX(id), 0) AS max FROM images`);
      if (cursor + SCAN_WINDOW < Number(max.rows[0].max)) {
        await setCursor(cursor + SCAN_WINDOW);
        continue;
      }
      console.log('[autotag-backfill] Reached the end, rescanning later');
      await importQuery(
        `INSERT INTO counters (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
        [COMPLETED_AT, Math.floor(Date.now() / 1000)]
      );
      await setCursor(0);
      await sleep(RESCAN_AFTER_MS);
      continue;
    }

    for (const post of batch.rows) {
      for (;;) {
        try {
          const added = await autotagPost({ id: post.id, sequentialId: post.sequential_id, url: post.url }, undefined, { revalidate: false });
          await bump(PROCESSED, 1);
          if (added.length) await bump(TAGS_ADDED, added.length);
          break;
        } catch (err: any) {
          if (err instanceof AutotaggerUnavailableError) {
            // Tagger down or overloaded: wait and retry the same post.
            await sleep(TAGGER_DOWN_RETRY_MS);
            continue;
          }
          // Unreadable or missing file: skip it for good.
          const reason = err instanceof UnreadableImageError ? 'unreadable' : String(err?.message || err);
          await markAutotagSkipped(post.id, reason).catch(() => {});
          await bump(PROCESSED, 1);
          break;
        }
      }
      await setCursor(post.id);
      await sleep(PAUSE_BETWEEN_POSTS_MS);
    }
  }
}
