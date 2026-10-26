import os from 'node:os';
import { cacheSet, getImportPool, importQuery } from '@/lib/db';
import { ensureSampleTable, generateSample, popQueuedSample, type SampleSource } from '@/lib/samples';

// Makes post samples (see lib/samples) in the background, a couple at a time:
//  1. posts someone just viewed or uploaded (Redis queue) first,
//  2. then posts newer than the newest one seen at startup,
//  3. then the back catalogue, newest first.
// One runner across processes (advisory lock), resumable (cursors in the
// counters table), on the bounded import pool. On by default; SAMPLE_WORKER=false
// turns it off, SAMPLE_CONCURRENCY sets how many run at once (default 2).

const LOCK_KEY = 72419641779;
const NEW_CURSOR = 'samplesNewCursor'; // highest id handled going forward
const BACK_CURSOR = 'samplesBackCursor'; // lowest id handled going backward
const DONE = 'samplesDone';
const CONCURRENCY = Math.max(1, Math.min(4, parseInt(process.env.SAMPLE_CONCURRENCY || '2', 10) || 2));
const BATCH = 20;
const IDLE_MS = 30_000;
const LOCK_RETRY_MS = 5 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let started = false;

export function startSampleWorker(): void {
  if (started || process.env.SAMPLE_WORKER === 'false') return;
  started = true;
  run().catch((err) => console.error('[samples] Worker stopped:', err));
}

async function getCounter(name: string): Promise<number | null> {
  const r = await importQuery(`SELECT value FROM counters WHERE name = $1`, [name]);
  return r.rows[0] ? Number(r.rows[0].value) : null;
}

async function setCounter(name: string, value: number) {
  await importQuery(
    `INSERT INTO counters (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
    [name, value]
  );
}

const COLUMNS = `i.id, i.sequential_id, i.url, i.width, i.height, i.file_size, i.content_type`;

async function byIds(ids: number[]): Promise<SampleSource[]> {
  if (ids.length === 0) return [];
  return (
    await importQuery<SampleSource>(
      `SELECT ${COLUMNS} FROM images i
       LEFT JOIN image_samples s ON s.image_id = i.id
       WHERE i.id = ANY($1::bigint[]) AND i.deleted = FALSE AND s.image_id IS NULL`,
      [ids]
    )
  ).rows;
}

async function nextBatch(): Promise<{ posts: SampleSource[]; advance?: () => Promise<void>; priority?: boolean }> {
  // 1. Viewed / uploaded posts
  const queued: number[] = [];
  for (let i = 0; i < BATCH; i++) {
    const id = await popQueuedSample();
    if (!id) break;
    queued.push(id);
  }
  // Posts someone is viewing right now: make these regardless of host load
  if (queued.length) return { posts: await byIds(queued), priority: true };

  // 2. New posts since the worker first started
  const newCursor = await getCounter(NEW_CURSOR);
  const fresh = (
    await importQuery<SampleSource>(
      `SELECT ${COLUMNS} FROM images i
       WHERE i.id > $1 AND i.deleted = FALSE
       ORDER BY i.id LIMIT $2`,
      [newCursor ?? 0, BATCH]
    )
  ).rows;
  if (fresh.length) {
    const top = Number(fresh[fresh.length - 1].id);
    return { posts: await byIds(fresh.map((p) => Number(p.id))), advance: () => setCounter(NEW_CURSOR, top) };
  }

  // 3. Back catalogue, newest first
  const backCursor = await getCounter(BACK_CURSOR);
  if (backCursor !== null && backCursor <= 1) return { posts: [] };
  const old = (
    await importQuery<SampleSource>(
      `SELECT ${COLUMNS} FROM images i
       WHERE i.id < $1 AND i.deleted = FALSE
       ORDER BY i.id DESC LIMIT $2`,
      [backCursor ?? Number.MAX_SAFE_INTEGER, BATCH]
    )
  ).rows;
  if (old.length === 0) {
    await setCounter(BACK_CURSOR, 1);
    console.log('[samples] Back catalogue finished');
    return { posts: [] };
  }
  const bottom = Number(old[old.length - 1].id);
  return { posts: await byIds(old.map((p) => Number(p.id))), advance: () => setCounter(BACK_CURSOR, bottom) };
}

async function loop() {
  await ensureSampleTable();
  // First start: everything up to now is "back catalogue", anything newer is "new"
  if ((await getCounter(NEW_CURSOR)) === null) {
    const max = Number((await importQuery(`SELECT COALESCE(MAX(id), 0) AS max FROM images`)).rows[0].max);
    await setCounter(NEW_CURSOR, max);
    await setCounter(BACK_CURSOR, max + 1);
  }

  let made = 0;
  let failed = 0;
  let windowStart = Date.now();
  for (;;) {
    const { posts, advance, priority } = await nextBatch();
    if (posts.length === 0 && !advance) {
      await sleep(IDLE_MS);
      continue;
    }
    // The box is shared (many apps + 40+ DBs on one disk) and usually runs
    // hot, so the bulk backfill only runs when the host has spare capacity;
    // posts someone is viewing (priority) are always made so nobody waits.
    const cpus = os.cpus().length || 1;
    if (!priority) {
      let waited = 0;
      while (os.loadavg()[0] > cpus * 1.2 && waited < 10 * 60_000) {
        await sleep(30_000);
        waited += 30_000;
      }
    }
    // One at a time under load, a couple when the host is calm; a short pause
    // between each keeps this from pinning a core or hammering the disk.
    for (let i = 0; i < posts.length; ) {
      const load = os.loadavg()[0];
      const n = priority ? CONCURRENCY : load > cpus * 1.2 ? 1 : CONCURRENCY;
      const results = await Promise.allSettled(posts.slice(i, i + n).map((p) => generateSample(p)));
      i += n;
      for (const r of results) {
        if (r.status === 'fulfilled') made++;
        else {
          failed++;
          if (failed <= 20 || failed % 100 === 0) console.warn('[samples] failed:', String(r.reason?.message || r.reason).slice(0, 200));
        }
      }
      if (!priority) await sleep(2_000);
    }
    if (advance) await advance();

    if (Date.now() - windowStart > 60_000) {
      const back = await getCounter(BACK_CURSOR);
      const line = `made=${made} failed=${failed} in ${Math.round((Date.now() - windowStart) / 1000)}s, back cursor at id ${back}`;
      console.log(`[samples] ${line}`);
      await cacheSet('samples:progress', line, 3600).catch(() => {});
      await importQuery(
        `INSERT INTO counters (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = counters.value + EXCLUDED.value`,
        [DONE, made]
      ).catch(() => {});
      made = 0;
      failed = 0;
      windowStart = Date.now();
    }
  }
}

async function run() {
  // Keep only libvips' own threads modest: this runs beside live traffic
  const sharp = (await import('sharp')).default;
  sharp.concurrency(2);
  sharp.cache(false);

  for (;;) {
    const client = await getImportPool().connect();
    let locked = false;
    try {
      locked = (await client.query(`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS ok`)).rows[0].ok;
      if (locked) {
        console.log(`[samples] Worker started (concurrency ${CONCURRENCY})`);
        await loop();
      }
    } catch (err) {
      console.error('[samples] Error, restarting soon:', err);
    } finally {
      if (locked) await client.query(`SELECT pg_advisory_unlock(${LOCK_KEY})`).catch(() => {});
      client.release();
    }
    await sleep(locked ? 30_000 : LOCK_RETRY_MS);
  }
}
