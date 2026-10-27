/**
 * End-to-end rehearsal of scripts/migrate-votes-compact.ts against a LOCAL,
 * THROWAWAY Postgres. It wipes the target database's public schema.
 *
 *   podman run -d --name votes-pg -e POSTGRES_HOST_AUTH_METHOD=trust \
 *     -e POSTGRES_DB=serika_test -p 127.0.0.1:55432:5432 docker.io/library/postgres:18
 *   POSTGRES_URL=postgres://postgres@127.0.0.1:55432/serika_test \
 *     bun --no-env-file scripts/votes-compact-e2e.ts [--votes 2000000] [--users 2000] [--images 200000]
 *
 * What it does: builds the legacy schema with the app's own ensureSchema(),
 * generates skewed synthetic votes (88/12 up/down), then runs every phase
 * (abort rehearsal, prepare, interrupted + resumed backfill, index, verify,
 * swap, rollback, swap again, cleanup) while writer loops cast votes through
 * lib/votes.ts (the code the routes use) and delete images and users.
 * Finally it checks that no vote was lost, duplicated or left stale, that the
 * app's queries return the same answers on both layouts, and that a fresh app
 * boot on the compact layout neither errors nor rebuilds the legacy indexes.
 *
 * `bun --no-env-file` matters: plain `bun` would load .env.local.
 */
import pg from 'pg';
import { spawn } from 'node:child_process';
import path from 'node:path';

const url = process.env.POSTGRES_URL || '';
const parsed = (() => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
})();
if (
  !parsed ||
  !['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname) ||
  !/test/i.test(parsed.pathname)
) {
  console.error('Refusing to run: POSTGRES_URL must point at localhost and a database whose name contains "test".');
  process.exit(2);
}

function arg(name: string, def: number): number {
  const i = process.argv.indexOf(name);
  return i === -1 ? def : Number(process.argv[i + 1]);
}
const N_VOTES = arg('--votes', 2_000_000);
const N_USERS = arg('--users', 2_000);
const N_IMAGES = arg('--images', 200_000);
const RESERVED_IMAGES = 500; // only the deleter touches images 1..500
const RESERVED_USERS = 20; // only the deleter touches the last 20 users
const PROD_ROWS = 244_500_000;
const WRITERS = 8; // concurrent vote writers, each owning a disjoint set of users

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const migrateScript = path.join(root, 'scripts', 'migrate-votes-compact.ts');

const pool = new pg.Pool({ connectionString: url, max: 10 });
const q = (sql: string, params?: unknown[]) => pool.query(sql, params);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function log(...a: unknown[]) {
  console.log(`[e2e ${new Date().toISOString().slice(11, 19)}]`, ...a);
}

const failures: string[] = [];
function errText(err: unknown): string {
  const e = err as { code?: string; message?: string };
  return `${e?.code ?? ''} ${e?.message ?? String(err)}`;
}
function check(cond: boolean, msg: string) {
  if (cond) log(`  ok: ${msg}`);
  else {
    log(`  FAIL: ${msg}`);
    failures.push(msg);
  }
}

/** Runs the migration script under node (the way the owner will run it). */
function migrate(args: string[], opts: { killAfterMs?: number; expectFail?: boolean } = {}): Promise<{ code: number; out: string; ms: number }> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn('node', ['--experimental-strip-types', '--no-warnings', migrateScript, ...args], {
      cwd: root,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, POSTGRES_URL: url, TZ: process.env.TZ ?? 'UTC' },
    });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      process.stdout.write(`    | ${String(d).trimEnd().replace(/\n/g, '\n    | ')}\n`);
    });
    child.stderr.on('data', (d) => {
      out += d;
      process.stdout.write(`    ! ${String(d).trimEnd().replace(/\n/g, '\n    ! ')}\n`);
    });
    if (opts.killAfterMs) setTimeout(() => child.kill('SIGINT'), opts.killAfterMs);
    child.on('close', (code) => {
      const ms = Date.now() - t0;
      if (code !== 0 && !opts.expectFail && !opts.killAfterMs) failures.push(`migrate ${args.join(' ')} exited ${code}`);
      resolve({ code: code ?? -1, out, ms });
    });
  });
}

async function sizes(rel: string) {
  const r = await q(
    `SELECT pg_relation_size($1::regclass) AS heap, pg_indexes_size($1::regclass) AS idx, pg_total_relation_size($1::regclass) AS total,
            (SELECT count(*) FROM ${rel}) AS rows`,
    [rel]
  );
  const x = r.rows[0];
  return { heap: Number(x.heap), idx: Number(x.idx), total: Number(x.total), rows: Number(x.rows) };
}
const gb = (b: number) => (b / 1024 ** 3).toFixed(2) + ' GB';
const mb = (b: number) => (b / 1024 ** 2).toFixed(1) + ' MB';

async function walBytesSince(lsn: string): Promise<number> {
  const r = await q(`SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), $1)::bigint AS b`, [lsn]);
  return Number(r.rows[0].b);
}
async function walNow(): Promise<string> {
  return (await q(`SELECT pg_current_wal_lsn()::text AS l`)).rows[0].l;
}

// ── Writers ─────────────────────────────────────────────────────────────────

type Votes = typeof import('../lib/votes');
let votesLib: Votes;
const expected = new Map<string, 'upvote' | 'downvote' | null>(); // "userId|imageId"
const deletedImages = new Set<number>();
const deletedUsers = new Set<string>();
let stopWriters = false;
const writerStats = { ops: 0, errors: 0, maxLatencyMs: 0, errorSamples: [] as string[] };

async function writer(w: number, users: string[]) {
  const mine = users.filter((_, i) => i % WRITERS === w);
  while (!stopWriters) {
    const userId = mine[Math.floor(Math.random() * mine.length)];
    const imageId = RESERVED_IMAGES + 1 + Math.floor(Math.random() * (N_IMAGES - RESERVED_IMAGES));
    const r = Math.random();
    const requested = r < 0.6 ? 'upvote' : r < 0.85 ? 'downvote' : '';
    const t0 = Date.now();
    try {
      const { current } = await votesLib.castVote(userId, imageId, requested as '' | 'upvote' | 'downvote');
      expected.set(`${userId}|${imageId}`, current);
      writerStats.ops++;
    } catch (err) {
      writerStats.errors++;
      if (writerStats.errorSamples.length < 10) writerStats.errorSamples.push(errText(err));
    }
    writerStats.maxLatencyMs = Math.max(writerStats.maxLatencyMs, Date.now() - t0);
    await sleep(1);
  }
}

async function deleter(reservedUsers: string[], allUsers: string[]) {
  let nextImage = 1;
  let nextUser = 0;
  let tick = 0;
  while (!stopWriters) {
    tick++;
    try {
      // Vote on reserved images (by any non-reserved user is not allowed: those
      // keys belong to other writers' models), so use reserved users only.
      const u = reservedUsers[Math.floor(Math.random() * reservedUsers.length)];
      if (!deletedUsers.has(u) && nextImage <= RESERVED_IMAGES) {
        const img = nextImage + Math.floor(Math.random() * (RESERVED_IMAGES - nextImage + 1));
        await votesLib.castVote(u, img, Math.random() < 0.5 ? 'upvote' : 'downvote');
      }
      if (tick % 20 === 0 && nextImage <= RESERVED_IMAGES) {
        // Hard delete through the cascade (like an admin hard delete).
        await q(`DELETE FROM images WHERE id = $1`, [nextImage]);
        deletedImages.add(nextImage);
        nextImage++;
      }
      if (tick % 150 === 0 && nextUser < reservedUsers.length - 2) {
        await q(`DELETE FROM users WHERE id = $1`, [reservedUsers[nextUser]]);
        deletedUsers.add(reservedUsers[nextUser]);
        nextUser++;
      }
      if (tick % 400 === 0) {
        // A brand-new user (gets num_id from the column default) who votes at once.
        const id = Math.random().toString(16).slice(2, 14).padEnd(24, 'a');
        await q(`INSERT INTO users (id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, `new_${id}`]);
        allUsers.push(id);
        const img = RESERVED_IMAGES + 1 + Math.floor(Math.random() * 1000);
        const { current } = await votesLib.castVote(id, img, 'upvote');
        expected.set(`${id}|${img}`, current);
      }
    } catch (err) {
      writerStats.errors++;
      if (writerStats.errorSamples.length < 10) writerStats.errorSamples.push(`deleter: ${errText(err)}`);
    }
    await sleep(20);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log(`target ${parsed!.host}${parsed!.pathname}; ${N_VOTES} votes, ${N_USERS} users, ${N_IMAGES} images`);
  await q(`DROP SCHEMA public CASCADE`);
  await q(`CREATE SCHEMA public`);

  // The app's own bootstrap creates the legacy schema and boot indexes.
  const db = await import('../lib/db');
  await db.ensureSchema();
  votesLib = await import('../lib/votes');
  check((await votesLib.getVotesSchema()) === 'legacy', 'fresh database detected as legacy layout');

  log('generating data');
  const t = Date.now();
  await q(`INSERT INTO users (id, username, created_at)
           SELECT substr(md5('u' || i), 1, 24), 'user' || i, now() - (i || ' minutes')::interval
           FROM generate_series(1, $1) i`, [N_USERS]);
  await q(`INSERT INTO images (id, sequential_id, url) SELECT i, i, 'https://example.invalid/' || i FROM generate_series(1, $1) i`, [N_IMAGES]);
  await q(`SELECT setval('images_id_seq', $1)`, [N_IMAGES]);
  // Skewed per-user vote counts (a few heavy users), unique image per user via
  // (i * 7919 + offset) mod N_IMAGES, ids in time order like production.
  await q(`
    WITH w AS (
      SELECT u.id, row_number() OVER (ORDER BY u.id) AS n, 1.0 / power(row_number() OVER (ORDER BY random()), 0.8) AS wt
      FROM users u
    ), k AS (
      SELECT id, n, LEAST($2::int, floor($1::numeric * wt / sum(wt) OVER ())::int) AS k FROM w
    ), v AS (
      SELECT k.id AS user_id, ((g.i::bigint * 7919 + k.n * 104729) % $2) + 1 AS image_id,
             CASE WHEN random() < 0.88 THEN 'upvote' ELSE 'downvote' END AS type, random() AS r
      FROM k, generate_series(1, k.k) g(i)
    )
    INSERT INTO votes (user_id, image_id, type, created_at)
    SELECT user_id, image_id, type,
           timestamptz '2024-01-01' + (row_number() OVER (ORDER BY r)) * interval '30 seconds' + random() * interval '1 second'
    FROM v ORDER BY r`, [N_VOTES, N_IMAGES]);
  await q(`VACUUM ANALYZE votes`);
  await q(`VACUUM ANALYZE users`);
  log(`data generated in ${((Date.now() - t) / 1000).toFixed(0)}s`);
  const legacySize = await sizes('votes');
  log(`legacy votes: ${legacySize.rows} rows, heap ${mb(legacySize.heap)}, indexes ${mb(legacySize.idx)}, total ${mb(legacySize.total)} (${(legacySize.total / legacySize.rows).toFixed(1)} B/row)`);
  const dist = await q(`SELECT type, count(*) FROM votes GROUP BY 1 ORDER BY 1`);
  log('type split', dist.rows.map((r) => `${r.type}=${r.count}`).join(' '));
  const userRows = (await q(`SELECT id FROM users ORDER BY id`)).rows.map((r) => r.id as string);
  const reservedUsers = userRows.slice(-RESERVED_USERS);
  const normalUsers = userRows.slice(0, -RESERVED_USERS);

  // ── Abort rehearsal ──
  log('== abort rehearsal: prepare, partial backfill, abort --drop-num-id');
  await migrate(['prepare', '--confirm', 'serika_test']);
  await migrate(['backfill', '--max-batches', '3', '--max-load', '0', '--sleep-ms', '0']);
  await migrate(['abort'], { expectFail: true }).then((r) => check(r.code !== 0, 'abort refuses without --confirm'));
  await migrate(['abort', '--confirm', 'serika_test', '--drop-num-id']);
  const leftovers = await q(`SELECT relname FROM pg_class WHERE relname LIKE 'votes_compact%'`);
  const numCol = await q(`SELECT 1 FROM pg_attribute WHERE attrelid = 'users'::regclass AND attname = 'num_id' AND NOT attisdropped`);
  const trig = await q(`SELECT tgname FROM pg_trigger WHERE tgname LIKE 'votes_compact%'`);
  check(leftovers.rowCount === 0 && numCol.rowCount === 0 && trig.rowCount === 0, 'abort removed every migration object');

  // Ground truth for keys no writer touches.
  await q(`CREATE TABLE votes_truth AS SELECT user_id, image_id, type, created_at FROM votes`);

  // ── Real run with live writers ──
  log('== starting writers');
  const writers = Array.from({ length: WRITERS }, (_, w) => writer(w, normalUsers));
  const del = deleter(reservedUsers, normalUsers);
  await sleep(1500);

  log('== prepare');
  let r = await migrate(['prepare', '--confirm', 'serika_test']);
  log(`prepare took ${r.ms} ms`);
  await sleep(1000);

  log('== backfill, throttled to 20k rows/s, stopped with SIGINT after 4 s');
  r = await migrate(['backfill', '--max-rows-per-sec', '20000', '--sleep-ms', '50', '--max-load', '0'], { killAfterMs: 4000 });
  check(r.code === 0, 'backfill stops cleanly on SIGINT');
  const mid = await q(`SELECT last_id, rows_copied FROM votes_compact_state`);
  const midCount = Number((await q(`SELECT count(*) FROM votes_compact`)).rows[0].count);
  check(Number(mid.rows[0].rows_copied) === midCount, `checkpoint matches copied rows after interrupt (${midCount})`);
  const throttledRate = midCount / (r.ms / 1000);
  log(`throttled run: ${midCount} rows in ${(r.ms / 1000).toFixed(1)}s => ${throttledRate.toFixed(0)} rows/s incl. startup (cap 20000)`);

  log('== backfill resume, unthrottled (benchmark)');
  const wal0 = await walNow();
  r = await migrate(['backfill', '--batch-size', '50000', '--max-rows-per-sec', '1000000000', '--sleep-ms', '0', '--max-load', '0', '--max-batch-ms', '60000']);
  const backfillWal = await walBytesSince(wal0);
  const compactRows = Number((await q(`SELECT count(*) FROM votes_compact`)).rows[0].count);
  const backfillRate = (compactRows - midCount) / (r.ms / 1000);
  log(`backfill: ${compactRows - midCount} rows in ${(r.ms / 1000).toFixed(1)}s => ${backfillRate.toFixed(0)} rows/s unthrottled; WAL ${mb(backfillWal)} (${(backfillWal / (compactRows - midCount)).toFixed(0)} B/row)`);
  const heapAfterBackfill = Number((await q(`SELECT pg_relation_size('votes_compact') AS s`)).rows[0].s);

  log('== index (settle, vacuum, indexes, FKs, catchup)');
  const wal1 = await walNow();
  r = await migrate(['index', '--max-load', '0', '--sleep-ms', '20', '--maintenance-work-mem', '256MB']);
  const indexWal = await walBytesSince(wal1);
  const indexMs = r.ms;
  const timings = [...r.out.matchAll(/index (\S+): done in (\S+)/g)].map((m) => `${m[1]} ${m[2]}`);
  const vacuumT = /vacuum: done in (\S+)/.exec(r.out)?.[1];
  log(`index phase ${(indexMs / 1000).toFixed(1)}s, WAL ${mb(indexWal)}; vacuum ${vacuumT}; ${timings.join(', ')}`);

  log('== verify (sample) and verify --full, writers running');
  r = await migrate(['verify', '--max-load', '0', '--sample-users', '30', '--sample-rows', '5000']);
  check(r.code === 0, 'verify (sample) passes with writers running');
  r = await migrate(['verify', '--full', '--max-load', '0', '--batch-size', '100000', '--max-rows-per-sec', '1000000000', '--sleep-ms', '0']);
  const fullVerifyMs = r.ms;
  // Counts can legitimately differ by in-flight writes in --full; the
  // row-level part must be clean.
  check(!/full: legacy row missing/.test(r.out), 'verify --full finds no missing/different legacy rows');

  log('== swap (writers running)');
  writerStats.maxLatencyMs = 0;
  r = await migrate(['swap', '--confirm', 'serika_test']);
  check(r.code === 0, 'swap succeeded');
  const swapMs = /swap: DONE in (\d+) ms/.exec(r.out)?.[1];
  log(`swap transaction held locks for ${swapMs} ms`);
  await sleep(4000);
  log(`writers: ${writerStats.ops} ops so far, ${writerStats.errors} errors, max latency around swap ${writerStats.maxLatencyMs} ms`);
  check((await votesLib.getVotesSchema()) === 'compact', 'app helpers switched to the compact layout');

  log('== verify after swap (votes vs mirrored votes_old)');
  r = await migrate(['verify', '--max-load', '0', '--sample-users', '30']);
  check(r.code === 0, 'post-swap verify passes (reverse mirror consistent)');

  log('== rollback and swap again, writers running');
  r = await migrate(['rollback', '--confirm', 'serika_test']);
  check(r.code === 0, 'rollback succeeded');
  await sleep(3000);
  check((await votesLib.getVotesSchema()) === 'legacy', 'app helpers switched back to legacy');
  await migrate(['catchup']);
  r = await migrate(['verify', '--max-load', '0']);
  check(r.code === 0, 'verify after rollback passes');
  r = await migrate(['swap', '--confirm', 'serika_test']);
  check(r.code === 0, 'second swap succeeded');
  await sleep(3000);

  stopWriters = true;
  await Promise.all([...writers, del]);
  log(`writers stopped: ${writerStats.ops} ops, ${writerStats.errors} errors, ${expected.size} keys touched, ${deletedImages.size} images and ${deletedUsers.size} users deleted`);
  for (const e of writerStats.errorSamples) log(`   error sample: ${e}`);
  check(writerStats.errors === 0, 'no writer errors across prepare/backfill/index/swap/rollback/swap');

  // ── Correctness ──
  log('== correctness checks');
  const diff1 = await q(`
    SELECT count(*) FROM (
      SELECT u.id, v.image_id, CASE WHEN v.is_up THEN 'upvote' ELSE 'downvote' END, v.created_at FROM votes v JOIN users u ON u.num_id = v.user_num
      EXCEPT ALL SELECT user_id, image_id, type, created_at FROM votes_old) d`);
  const diff2 = await q(`
    SELECT count(*) FROM (
      SELECT user_id, image_id, type, created_at FROM votes_old
      EXCEPT ALL SELECT u.id, v.image_id, CASE WHEN v.is_up THEN 'upvote' ELSE 'downvote' END, v.created_at FROM votes v JOIN users u ON u.num_id = v.user_num) d`);
  check(Number(diff1.rows[0].count) === 0 && Number(diff2.rows[0].count) === 0, `votes == votes_old exactly (diffs ${diff1.rows[0].count}/${diff2.rows[0].count})`);
  const orphanUsers = await q(`SELECT count(*) FROM votes v WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.num_id = v.user_num)`);
  check(Number(orphanUsers.rows[0].count) === 0, 'no votes of deleted users');
  const orphanImages = await q(`SELECT count(*) FROM votes v WHERE NOT EXISTS (SELECT 1 FROM images i WHERE i.id = v.image_id)`);
  check(Number(orphanImages.rows[0].count) === 0, 'no votes on deleted images');

  // Every key a writer touched has exactly its last written state.
  const keys = [...expected.entries()];
  let wrong = 0;
  for (let i = 0; i < keys.length; i += 5000) {
    const chunk = keys.slice(i, i + 5000);
    const res = await q(
      `SELECT k.uid, k.img, CASE WHEN v.is_up THEN 'upvote' WHEN v.is_up = false THEN 'downvote' END AS t
       FROM unnest($1::text[], $2::int[]) AS k(uid, img)
       LEFT JOIN users u ON u.id = k.uid
       LEFT JOIN votes v ON v.user_num = u.num_id AND v.image_id = k.img`,
      [chunk.map(([k]) => k.split('|')[0]), chunk.map(([k]) => Number(k.split('|')[1]))]
    );
    const got = new Map(res.rows.map((x) => [`${x.uid}|${x.img}`, x.t ?? null]));
    for (const [k, want] of chunk) if ((got.get(k) ?? null) !== want) wrong++;
  }
  check(wrong === 0, `all ${keys.length} writer-touched keys hold their last written vote (${wrong} wrong)`);

  // Keys nobody touched equal the original data exactly.
  await q(`CREATE TEMP TABLE touched (uid text, img int)`);
  for (let i = 0; i < keys.length; i += 10000) {
    const chunk = keys.slice(i, i + 10000);
    await q(`INSERT INTO touched SELECT * FROM unnest($1::text[], $2::int[])`, [chunk.map(([k]) => k.split('|')[0]), chunk.map(([k]) => Number(k.split('|')[1]))]);
  }
  const untouched = await q(`
    WITH truth AS (
      SELECT t.* FROM votes_truth t
      WHERE t.image_id > ${RESERVED_IMAGES} AND t.user_id <> ALL($1::text[])
        AND NOT EXISTS (SELECT 1 FROM touched x WHERE x.uid = t.user_id AND x.img = t.image_id)
    ), now AS (
      SELECT u.id AS user_id, v.image_id, CASE WHEN v.is_up THEN 'upvote' ELSE 'downvote' END AS type, v.created_at
      FROM votes v JOIN users u ON u.num_id = v.user_num
      WHERE v.image_id > ${RESERVED_IMAGES} AND u.id <> ALL($1::text[])
        AND NOT EXISTS (SELECT 1 FROM touched x WHERE x.uid = u.id AND x.img = v.image_id)
    )
    SELECT (SELECT count(*) FROM (SELECT * FROM truth EXCEPT ALL SELECT * FROM now) a) AS missing,
           (SELECT count(*) FROM (SELECT * FROM now EXCEPT ALL SELECT * FROM truth) b) AS extra,
           (SELECT count(*) FROM truth) AS n`, [reservedUsers]);
  const u0 = untouched.rows[0];
  check(Number(u0.missing) === 0 && Number(u0.extra) === 0, `all ${u0.n} untouched votes identical to the original (missing ${u0.missing}, extra ${u0.extra})`);

  // ── App query parity on both layouts ──
  log('== app query parity (compact helpers vs legacy SQL on votes_old)');
  const sampleUsers = (await q(`SELECT DISTINCT u.id FROM votes_old v JOIN users u ON u.id = v.user_id ORDER BY 1 LIMIT 60`)).rows.map((x) => x.id as string);
  let likeMismatch = 0;
  for (const uid of sampleUsers) {
    const a = (await votesLib.listUpvotedImages(uid, 50)).map((x) => x.id);
    const b = (await q(`SELECT i.id FROM votes_old v JOIN images i ON i.id = v.image_id WHERE v.user_id = $1 AND v.type = 'upvote' ORDER BY v.created_at DESC LIMIT 50`, [uid])).rows.map((x) => x.id);
    if (JSON.stringify(a) !== JSON.stringify(b)) likeMismatch++;
  }
  check(likeMismatch === 0, `liked-images list identical for ${sampleUsers.length} users`);
  const someVotes = (await q(`SELECT user_id, image_id, type FROM votes_old TABLESAMPLE SYSTEM (1) LIMIT 300`)).rows;
  let voteMismatch = 0;
  for (const v of someVotes) if ((await votesLib.getUserVote(v.user_id, v.image_id)) !== v.type) voteMismatch++;
  check(voteMismatch === 0, `getUserVote matches votes_old for ${someVotes.length} sampled votes`);
  check((await votesLib.getUserVote(normalUsers[0], 999_999_999)) === null, 'getUserVote returns null for no vote');

  const plan = async (sql: string, params: unknown[]) =>
    (await q(`EXPLAIN (COSTS OFF) ${sql}`, params)).rows.map((x) => x['QUERY PLAN']).join('\n');
  const numId = (await q(`SELECT num_id FROM users WHERE id = $1`, [sampleUsers[0]])).rows[0].num_id;
  const { VOTE_SQL } = await import('../lib/votesSchema');
  const pGet = await plan(VOTE_SQL.compact.get, [numId, 1000]);
  const pLikes = await plan(VOTE_SQL.compact.likes, [numId, 50]);
  const pImg = await plan(`DELETE FROM votes WHERE image_id = $1`, [1000]);
  check(/votes_compact_pkey/.test(pGet), 'get/remove/change use the primary key');
  check(/idx_votes_compact_user_up/.test(pLikes), 'liked-images query uses the partial index');
  check(/idx_votes_compact_image/.test(pImg), 'image hard delete uses idx_votes_compact_image');

  // ── Sizes ──
  const oldSize = await sizes('votes_old');
  const idx = await q(`SELECT c.relname, pg_relation_size(c.oid) AS s FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE i.indrelid = 'votes'::regclass ORDER BY 1`);

  // ── Fresh app boot on the compact layout ──
  log('== fresh app boot on compact layout (ensureSchema in a new process)');
  const boot = await new Promise<string>((resolve) => {
    const child = spawn('bun', ['--no-env-file', '-e', `import('./lib/db').then(m => m.ensureSchema()).then(() => process.exit(0))`], {
      cwd: root,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, POSTGRES_URL: url },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', () => resolve(out));
  });
  log(boot.trim().split('\n').map((l) => `    boot| ${l}`).join('\n'));
  check(!/Failed|Error/i.test(boot), 'boot on compact layout logs no errors');
  const legacyIdxOnVotes = await q(`SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE i.indrelid = 'votes'::regclass AND c.relname IN ('idx_votes_user', 'idx_votes_image')`);
  check(legacyIdxOnVotes.rowCount === 0, 'boot did not build legacy votes indexes on the compact table');

  log('== cleanup');
  r = await migrate(['cleanup', '--confirm', 'serika_test'], { expectFail: true });
  check(r.code !== 0, 'cleanup refuses before --min-age-days');
  r = await migrate(['cleanup', '--confirm', 'serika_test', '--force']);
  check(!(await q(`SELECT to_regclass('votes_old') AS t`)).rows[0].t, 'votes_old dropped');
  r = await migrate(['validate-fk']);
  check(r.code === 0, 'validate-fk succeeds (no orphan rows)');
  const boot2 = await new Promise<string>((resolve) => {
    const child = spawn('bun', ['--no-env-file', '-e', `import('./lib/db').then(m => m.ensureSchema()).then(() => process.exit(0))`], {
      cwd: root,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, POSTGRES_URL: url },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', () => resolve(out));
  });
  check(!/Failed|Error/i.test(boot2), 'boot after cleanup (no votes_id_seq) logs no errors');
  const finalSize = await sizes('votes');

  // ── Report ──
  const perRowOld = legacySize.total / legacySize.rows;
  const perRowNew = finalSize.total / finalSize.rows;
  const prodNew = (perRowNew * PROD_ROWS);
  console.log('\n================ SUMMARY ================');
  console.log(`rows: legacy ${legacySize.rows}, compact ${finalSize.rows}`);
  console.log(`legacy (freshly built here): heap ${mb(legacySize.heap)} + idx ${mb(legacySize.idx)} = ${mb(legacySize.total)} (${perRowOld.toFixed(1)} B/row)`);
  console.log(`legacy at end (votes_old, after mirror writes): ${mb(oldSize.total)}`);
  console.log(`compact: heap ${mb(finalSize.heap)} + idx ${mb(finalSize.idx)} = ${mb(finalSize.total)} (${perRowNew.toFixed(1)} B/row; heap ${(finalSize.heap / finalSize.rows).toFixed(1)} B/row)`);
  for (const i of idx.rows) console.log(`   ${i.relname}: ${mb(Number(i.s))} (${(Number(i.s) / finalSize.rows).toFixed(1)} B/row)`);
  console.log(`reduction vs fresh legacy: ${((1 - perRowNew / perRowOld) * 100).toFixed(1)}%`);
  console.log(`extrapolated to ${PROD_ROWS / 1e6}M rows: compact ~${gb(prodNew)} (heap ${gb((finalSize.heap / finalSize.rows) * PROD_ROWS)}) vs prod legacy 71 GB => ${((1 - prodNew / (71 * 1024 ** 3)) * 100).toFixed(1)}% smaller`);
  console.log(`backfill unthrottled: ${backfillRate.toFixed(0)} rows/s; WAL ${(backfillWal / (compactRows - midCount)).toFixed(0)} B/row => ~${gb((backfillWal / (compactRows - midCount)) * PROD_ROWS)} WAL at prod scale`);
  console.log(`heap after backfill ${mb(heapAfterBackfill)}; index phase ${(indexMs / 1000).toFixed(1)}s for ${compactRows} rows (WAL ${mb(indexWal)}): ${timings.join(', ')}; vacuum ${vacuumT}`);
  console.log(`verify --full: ${(fullVerifyMs / 1000).toFixed(1)}s; swap lock held ${swapMs} ms; writer max latency ${writerStats.maxLatencyMs} ms; writer ops ${writerStats.ops}`);
  console.log(failures.length ? `\nFAILURES (${failures.length}):\n - ${failures.join('\n - ')}` : '\nALL CHECKS PASSED');
  await pool.end();
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
