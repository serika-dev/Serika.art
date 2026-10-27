/**
 * Online, resumable compaction of the `votes` table.
 *
 *   legacy  votes(id serial PK, user_id text, image_id int, type text, created_at)
 *           + UNIQUE (user_id, image_id), idx_votes_user, idx_votes_image
 *   compact votes(user_num int, image_id int, is_up bool, created_at)
 *           + PRIMARY KEY (user_num, image_id), idx_votes_compact_image,
 *             idx_votes_compact_user_up (user_num, created_at DESC) WHERE is_up
 *           user_num = users.num_id (new integer column on users)
 *
 * Read docs/votes-compaction.md before running anything against production.
 *
 * Usage:
 *   POSTGRES_URL=... node --experimental-strip-types scripts/migrate-votes-compact.ts <phase> [flags]
 *   (or `bun --no-env-file scripts/...`, or `npx tsx scripts/...`)
 *
 * Phases (each idempotent; re-running continues where it stopped):
 *   status       read-only progress / sizes
 *   prepare      users.num_id, votes_compact + log/state tables, change-log triggers on votes
 *   backfill     throttled copy of votes (id <= high-water mark) into votes_compact
 *   index        settle rows changed during backfill, VACUUM (FREEZE, ANALYZE),
 *                build PK + indexes CONCURRENTLY, add FKs NOT VALID, drain the log
 *   catchup      apply logged changes to votes_compact (use --follow to keep it running)
 *   verify       sample (or --full) comparison of both tables
 *   swap         one short transaction: rename votes -> votes_old, votes_compact -> votes
 *   rollback     after swap: rename back (votes_old is kept current by a reverse trigger)
 *   validate-fk  optional: VALIDATE the NOT VALID foreign keys (one table scan)
 *   cleanup      days after swap: drop votes_old, triggers and helper tables
 *   abort        before swap: drop everything the migration created
 *
 * Flags: --dry-run (print SQL, never connect), see parseArgs() for the rest.
 *
 * How nothing is lost: from `prepare` on, statement-level triggers append the
 * (user_id, image_id) key of every inserted/updated/deleted vote, and the
 * num_id of every deleted user, to votes_compact_log. The backfill copies
 * blindly; afterwards every logged key is re-read from `votes` and rewritten
 * in votes_compact (delete + insert of the current row). A key that was never
 * logged has not changed since `prepare`, so its copied row is exact. The
 * final drain runs inside the swap transaction while `votes` is locked, so
 * the two tables are identical at the moment of the rename.
 */
import pg from 'pg';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── Pure helpers (unit-tested in tests/votesCompact.test.ts) ────────────────

export type Phase =
  | 'status' | 'prepare' | 'backfill' | 'index' | 'catchup' | 'verify'
  | 'swap' | 'rollback' | 'validate-fk' | 'cleanup' | 'abort';

export const PHASES: Phase[] = [
  'status', 'prepare', 'backfill', 'index', 'catchup', 'verify',
  'swap', 'rollback', 'validate-fk', 'cleanup', 'abort',
];

export interface Options {
  phase: Phase;
  dryRun: boolean;
  batchSize: number;
  maxRowsPerSec: number;
  sleepMs: number;
  maxBatchMs: number;
  maxLoad: number;
  until: string | null;
  pauseFile: string;
  maxBatches: number;
  statementTimeoutMs: number;
  lockTimeoutMs: number;
  maxAttempts: number;
  maintenanceWorkMem: string;
  parallelWorkers: number;
  vacuumCostDelayMs: number;
  vacuumCostLimit: number;
  settlePages: number;
  catchupBatch: number;
  follow: boolean;
  sampleRows: number;
  sampleUsers: number;
  maxUserRows: number;
  full: boolean;
  confirm: string | null;
  minAgeDays: number;
  reverseMirror: boolean;
  dropNumId: boolean;
  force: boolean;
}

export const DEFAULTS: Omit<Options, 'phase'> = {
  dryRun: false,
  batchSize: 20_000, // target rows per backfill transaction
  maxRowsPerSec: 5_000, // hard cap on copy rate (rows/s)
  sleepMs: 250, // minimum pause between batches
  maxBatchMs: 4_000, // a slower batch halves the batch size (host is struggling)
  maxLoad: 1.2, // pause while 1-min loadavg > maxLoad x CPUs of THIS machine; 0 = off
  until: null, // HH:MM local time: stop cleanly at this time
  pauseFile: '/tmp/votes-compact.pause', // while this file exists the loops wait
  maxBatches: 0, // stop after N batches (0 = unlimited)
  statementTimeoutMs: 60_000,
  lockTimeoutMs: 3_000,
  maxAttempts: 20, // lock retries for DDL / swap
  maintenanceWorkMem: '512MB',
  parallelWorkers: 0, // max_parallel_maintenance_workers for index builds
  vacuumCostDelayMs: 2,
  vacuumCostLimit: 200,
  settlePages: 4_096, // heap pages (8 kB) per settle chunk = 32 MB
  catchupBatch: 5_000, // log rows per catchup transaction
  follow: false,
  sampleRows: 2_000,
  sampleUsers: 25,
  maxUserRows: 250_000, // verify skips sampled users with more votes than this
  full: false,
  confirm: null,
  minAgeDays: 3,
  reverseMirror: true,
  dropNumId: false,
  force: false,
};

const NUMERIC_FLAGS: Record<string, keyof Options> = {
  '--batch-size': 'batchSize',
  '--max-rows-per-sec': 'maxRowsPerSec',
  '--sleep-ms': 'sleepMs',
  '--max-batch-ms': 'maxBatchMs',
  '--max-load': 'maxLoad',
  '--max-batches': 'maxBatches',
  '--statement-timeout-ms': 'statementTimeoutMs',
  '--lock-timeout-ms': 'lockTimeoutMs',
  '--max-attempts': 'maxAttempts',
  '--parallel-workers': 'parallelWorkers',
  '--vacuum-cost-delay-ms': 'vacuumCostDelayMs',
  '--vacuum-cost-limit': 'vacuumCostLimit',
  '--settle-pages': 'settlePages',
  '--catchup-batch': 'catchupBatch',
  '--sample-rows': 'sampleRows',
  '--sample-users': 'sampleUsers',
  '--max-user-rows': 'maxUserRows',
  '--min-age-days': 'minAgeDays',
};

const STRING_FLAGS: Record<string, keyof Options> = {
  '--until': 'until',
  '--pause-file': 'pauseFile',
  '--maintenance-work-mem': 'maintenanceWorkMem',
  '--confirm': 'confirm',
};

const BOOLEAN_FLAGS: Record<string, [keyof Options, boolean]> = {
  '--dry-run': ['dryRun', true],
  '--follow': ['follow', true],
  '--full': ['full', true],
  '--no-reverse-mirror': ['reverseMirror', false],
  '--drop-num-id': ['dropNumId', true],
  '--force': ['force', true],
};

/** Parses `<phase> [--flag value | --flag=value ...]`. Throws on anything unknown. */
export function parseArgs(argv: string[]): Options {
  const opts: Record<string, unknown> = { ...DEFAULTS };
  let phase: Phase | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      if (phase) throw new Error(`Unexpected argument: ${arg}`);
      if (!(PHASES as string[]).includes(arg)) {
        throw new Error(`Unknown phase "${arg}". Phases: ${PHASES.join(', ')}`);
      }
      phase = arg as Phase;
      continue;
    }
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? null : arg.slice(eq + 1);
    if (name in BOOLEAN_FLAGS) {
      if (inline !== null) throw new Error(`${name} takes no value`);
      const [key, value] = BOOLEAN_FLAGS[name];
      opts[key] = value;
      continue;
    }
    const takeValue = (): string => {
      if (inline !== null) return inline;
      const next = argv[++i];
      if (next === undefined) throw new Error(`${name} needs a value`);
      return next;
    };
    if (name in NUMERIC_FLAGS) {
      const raw = takeValue();
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) throw new Error(`${name}: "${raw}" is not a number >= 0`);
      opts[NUMERIC_FLAGS[name]] = value;
    } else if (name in STRING_FLAGS) {
      opts[STRING_FLAGS[name]] = takeValue();
    } else {
      throw new Error(`Unknown flag ${name}`);
    }
  }
  if (!phase) throw new Error(`Missing phase. Phases: ${PHASES.join(', ')}`);
  if (opts.until !== null) parseUntil(opts.until as string, new Date()); // validate early
  if ((opts.batchSize as number) < 1) throw new Error('--batch-size must be >= 1');
  if ((opts.maxRowsPerSec as number) < 1) throw new Error('--max-rows-per-sec must be >= 1');
  if (!/^\d+\s*(kB|MB|GB)$/.test(opts.maintenanceWorkMem as string)) {
    throw new Error('--maintenance-work-mem must look like 512MB');
  }
  return { ...(opts as Omit<Options, 'phase'>), phase };
}

/**
 * Next local wall-clock occurrence of HH:MM after `now` (tomorrow if that
 * time already passed today), e.g. a run started 23:10 with --until 06:30
 * stops at 06:30 the next morning.
 */
export function parseUntil(value: string, now: Date): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`--until expects HH:MM, got "${value}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`--until expects HH:MM, got "${value}"`);
  const at = new Date(now);
  at.setHours(h, min, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

/**
 * Pause after a batch: at least `minSleepMs`, and long enough that the
 * average rate stays at or below `maxRowsPerSec`.
 */
export function computeSleepMs(rows: number, elapsedMs: number, maxRowsPerSec: number, minSleepMs: number): number {
  const budgetMs = (rows / maxRowsPerSec) * 1000;
  return Math.max(minSleepMs, Math.ceil(budgetMs - elapsedMs));
}

/**
 * Batch-size feedback: a batch slower than maxBatchMs halves the target (the
 * database is busy); a fast one grows it back by 25% up to the configured
 * size.
 */
export function adjustBatchTarget(current: number, elapsedMs: number, maxBatchMs: number, configured: number): number {
  const floor = Math.min(1_000, configured);
  if (elapsedMs > maxBatchMs) return Math.max(floor, Math.floor(current / 2));
  if (elapsedMs < maxBatchMs / 4 && current < configured) return Math.min(configured, Math.ceil(current * 1.25));
  return current;
}

/**
 * Width of the next id window so it holds about `targetRows` rows, given how
 * many rows the last window of `prevWindow` ids held (ids have gaps).
 */
export function nextWindow(prevWindow: number, rowsInPrev: number, targetRows: number, maxWindow: number): number {
  let next: number;
  if (rowsInPrev <= 0) next = prevWindow * 4;
  else next = Math.round(prevWindow * (targetRows / rowsInPrev));
  // Change gradually so one dense or sparse window does not swing it wildly.
  next = Math.min(next, prevWindow * 4);
  next = Math.max(next, Math.floor(prevWindow / 4));
  return Math.max(1, Math.min(maxWindow, Math.max(targetRows > 0 ? 1 : 0, next)));
}

/** postgres://user:pass@host:port/db -> host:port/db (no credentials). */
export function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '?';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '?';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (Math.abs(v) >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** '(123,0)' — first tuple of heap page 123, for TID range scans. */
export function tidAt(page: number): string {
  return `(${Math.floor(page)},0)`;
}

/** Compares a vote row from each side. created_at is compared to the microsecond. */
export function sameVote(
  a: { is_up: boolean; created_at: Date | string } | undefined,
  b: { is_up: boolean; created_at: Date | string } | undefined
): boolean {
  if (!a || !b) return a === b;
  return a.is_up === b.is_up && String(a.created_at) === String(b.created_at);
}

// ── SQL ─────────────────────────────────────────────────────────────────────

const VOTE_IS_UP = `CASE v.type WHEN 'upvote' THEN true WHEN 'downvote' THEN false END`;

// Per-key lookups are written as LATERAL (... LIMIT 1): the planner cannot
// flatten those into a join, so each key is one index probe. A plain join
// lets it pick a hash join over a full scan of a 12-19 GB table, which it
// does as soon as the key list is a few % of the table.
const LEGACY_ROW_BY_KEY = (table: string, userIdExpr: string, imageIdExpr: string) =>
  `(SELECT type, created_at FROM ${table} WHERE user_id = ${userIdExpr} AND image_id = ${imageIdExpr} LIMIT 1)`;
const COMPACT_ROW_BY_KEY = (table: string, userNumExpr: string, imageIdExpr: string) =>
  `(SELECT is_up, created_at FROM ${table} WHERE user_num = ${userNumExpr} AND image_id = ${imageIdExpr} LIMIT 1)`;

const SQL = {
  numIdSeq: `CREATE SEQUENCE IF NOT EXISTS users_num_id_seq AS integer`,
  numIdColumn: `ALTER TABLE users ADD COLUMN IF NOT EXISTS num_id integer`,
  numIdDefault: `ALTER TABLE users ALTER COLUMN num_id SET DEFAULT nextval('users_num_id_seq')`,
  numIdOwned: `ALTER SEQUENCE users_num_id_seq OWNED BY users.num_id`,
  numIdFill: `
    UPDATE users u SET num_id = s.n
    FROM (
      SELECT id, nextval('users_num_id_seq') AS n
      FROM (SELECT id FROM users WHERE num_id IS NULL ORDER BY created_at, id) o
    ) s
    WHERE u.id = s.id AND u.num_id IS NULL`,
  numIdIndex: `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS users_num_id_key ON users (num_id)`,
  numIdNotNull: `ALTER TABLE users ALTER COLUMN num_id SET NOT NULL`,
  numIdConstraint: `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND conname = 'users_num_id_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_num_id_key UNIQUE USING INDEX users_num_id_key;
      END IF;
    END $$`,

  createCompact: `
    CREATE TABLE IF NOT EXISTS votes_compact (
      user_num   integer     NOT NULL,
      image_id   integer     NOT NULL,
      is_up      boolean     NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    ) WITH (autovacuum_enabled = false)`,
  createLog: `
    CREATE TABLE IF NOT EXISTS votes_compact_log (
      id        bigserial PRIMARY KEY,
      user_id   text,
      user_num  integer,
      image_id  integer,
      logged_at timestamptz NOT NULL DEFAULT now()
    )`,
  createSettle: `
    CREATE TABLE IF NOT EXISTS votes_compact_settle (
      id       bigserial PRIMARY KEY,
      user_num integer NOT NULL,
      image_id integer
    )`,
  createState: `
    CREATE TABLE IF NOT EXISTS votes_compact_state (
      singleton           boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      prepared_at         timestamptz,
      hwm                 integer,
      last_id             integer NOT NULL DEFAULT 0,
      rows_copied         bigint  NOT NULL DEFAULT 0,
      backfill_started_at timestamptz,
      backfill_done_at    timestamptz,
      settle_page         bigint,
      settle_pages        bigint,
      settled_at          timestamptz,
      vacuumed_at         timestamptz,
      indexed_at          timestamptz,
      verified_at         timestamptz,
      verify_ok           boolean,
      swapped_at          timestamptz,
      updated_at          timestamptz NOT NULL DEFAULT now()
    )`,
  initState: `INSERT INTO votes_compact_state DEFAULT VALUES ON CONFLICT DO NOTHING`,

  logFn: `
    CREATE OR REPLACE FUNCTION votes_compact_log_votes() RETURNS trigger
    LANGUAGE plpgsql AS $fn$
    BEGIN
      -- Statement-level with transition tables: one INSERT per statement,
      -- also for ON DELETE CASCADE from users/images.
      IF TG_OP = 'INSERT' THEN
        INSERT INTO votes_compact_log (user_id, image_id) SELECT user_id, image_id FROM new_rows;
      ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO votes_compact_log (user_id, image_id)
          SELECT user_id, image_id FROM old_rows
          UNION SELECT user_id, image_id FROM new_rows;
      ELSE
        INSERT INTO votes_compact_log (user_id, image_id) SELECT user_id, image_id FROM old_rows;
      END IF;
      RETURN NULL;
    END $fn$`,
  logUsersFn: `
    CREATE OR REPLACE FUNCTION votes_compact_log_users() RETURNS trigger
    LANGUAGE plpgsql AS $fn$
    BEGIN
      -- The cascaded vote deletes can no longer resolve the user's num_id,
      -- so a deleted user is logged as a whole (image_id NULL).
      INSERT INTO votes_compact_log (user_num) SELECT num_id FROM old_rows WHERE num_id IS NOT NULL;
      RETURN NULL;
    END $fn$`,
  noTruncateFn: `
    CREATE OR REPLACE FUNCTION votes_compact_no_truncate() RETURNS trigger
    LANGUAGE plpgsql AS $fn$
    BEGIN
      RAISE EXCEPTION 'TRUNCATE of % is blocked while the votes compaction is in progress (docs/votes-compaction.md)', TG_TABLE_NAME;
    END $fn$`,
  forwardTriggers: [
    `CREATE OR REPLACE TRIGGER votes_compact_log_ins AFTER INSERT ON votes
       REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION votes_compact_log_votes()`,
    `CREATE OR REPLACE TRIGGER votes_compact_log_upd AFTER UPDATE ON votes
       REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION votes_compact_log_votes()`,
    `CREATE OR REPLACE TRIGGER votes_compact_log_del AFTER DELETE ON votes
       REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION votes_compact_log_votes()`,
    `CREATE OR REPLACE TRIGGER votes_compact_no_truncate BEFORE TRUNCATE ON votes
       FOR EACH STATEMENT EXECUTE FUNCTION votes_compact_no_truncate()`,
    `CREATE OR REPLACE TRIGGER votes_compact_log_users AFTER DELETE ON users
       REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION votes_compact_log_users()`,
  ],
  dropForwardTriggersOn: (table: string) => [
    `DROP TRIGGER IF EXISTS votes_compact_log_ins ON ${table}`,
    `DROP TRIGGER IF EXISTS votes_compact_log_upd ON ${table}`,
    `DROP TRIGGER IF EXISTS votes_compact_log_del ON ${table}`,
    `DROP TRIGGER IF EXISTS votes_compact_no_truncate ON ${table}`,
  ],

  // After the swap: keep votes_old identical to the live (compact) votes so
  // a rollback loses nothing. Same write cost as before the migration.
  reverseFn: `
    CREATE OR REPLACE FUNCTION votes_compact_reverse_mirror() RETURNS trigger
    LANGUAGE plpgsql AS $fn$
    DECLARE uid text;
    BEGIN
      IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND (NEW.user_num, NEW.image_id) IS DISTINCT FROM (OLD.user_num, OLD.image_id)) THEN
        SELECT id INTO uid FROM users WHERE num_id = OLD.user_num;
        -- uid is NULL when the user itself is being deleted; votes_old's own
        -- ON DELETE CASCADE removes those rows.
        IF uid IS NOT NULL THEN
          DELETE FROM votes_old WHERE user_id = uid AND image_id = OLD.image_id;
        END IF;
      END IF;
      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT id INTO uid FROM users WHERE num_id = NEW.user_num;
        INSERT INTO votes_old (user_id, image_id, type, created_at)
        VALUES (uid, NEW.image_id, CASE WHEN NEW.is_up THEN 'upvote' ELSE 'downvote' END, NEW.created_at)
        ON CONFLICT (user_id, image_id) DO UPDATE SET type = EXCLUDED.type, created_at = EXCLUDED.created_at;
      END IF;
      RETURN NULL;
    END $fn$`,
  reverseTrigger: `CREATE OR REPLACE TRIGGER votes_compact_reverse_mirror AFTER INSERT OR UPDATE OR DELETE ON votes
       FOR EACH ROW EXECUTE FUNCTION votes_compact_reverse_mirror()`,

  // $1 = last copied id, $2 = window end (inclusive, <= hwm)
  backfillBatch: `
    INSERT INTO votes_compact (user_num, image_id, is_up, created_at)
    SELECT u.num_id, v.image_id, ${VOTE_IS_UP}, v.created_at
    FROM votes v
    JOIN users u ON u.id = v.user_id
    WHERE v.id > $1 AND v.id <= $2`,
  backfillCheckpoint: `
    UPDATE votes_compact_state
    SET last_id = $1, rows_copied = rows_copied + $2, updated_at = now(),
        backfill_done_at = CASE WHEN $1 >= hwm THEN now() END`,

  // Move every visible log row into the settle set (one transaction).
  settleCapture: `
    WITH taken AS (
      DELETE FROM votes_compact_log RETURNING user_id, user_num, image_id
    )
    INSERT INTO votes_compact_settle (user_num, image_id)
    SELECT DISTINCT COALESCE(t.user_num, u.num_id), t.image_id
    FROM taken t LEFT JOIN users u ON u.id = t.user_id
    WHERE COALESCE(t.user_num, u.num_id) IS NOT NULL`,
  // $1, $2 = tid range [from, to)
  settleDeleteKeys: `
    DELETE FROM votes_compact c USING votes_compact_settle k
    WHERE c.ctid >= $1::tid AND c.ctid < $2::tid
      AND k.image_id IS NOT NULL AND c.user_num = k.user_num AND c.image_id = k.image_id`,
  settleDeleteUsers: `
    DELETE FROM votes_compact c
    WHERE c.ctid >= $1::tid AND c.ctid < $2::tid
      AND c.user_num IN (SELECT user_num FROM votes_compact_settle WHERE image_id IS NULL)`,
  // $1 = keys per chunk. Consumes the chunk from the settle set in the same
  // statement, so an interrupted run resumes without double inserts.
  settleReinsert: `
    WITH chunk AS (
      DELETE FROM votes_compact_settle
      WHERE id IN (SELECT id FROM votes_compact_settle WHERE image_id IS NOT NULL ORDER BY id LIMIT $1)
      RETURNING user_num, image_id
    )
    INSERT INTO votes_compact (user_num, image_id, is_up, created_at)
    SELECT k.user_num, k.image_id, ${VOTE_IS_UP}, v.created_at
    FROM chunk k
    JOIN users u ON u.num_id = k.user_num
    CROSS JOIN LATERAL ${LEGACY_ROW_BY_KEY('votes', 'u.id', 'k.image_id')} v`,

  // Catchup (needs the PK). vc_keys is a session temp table.
  catchupKeysTable: `CREATE TEMP TABLE IF NOT EXISTS vc_keys (user_num integer NOT NULL, image_id integer) ON COMMIT DELETE ROWS`,
  // $1 = max log rows
  catchupTake: `
    WITH taken AS (
      DELETE FROM votes_compact_log
      WHERE id IN (SELECT id FROM votes_compact_log ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
      RETURNING user_id, user_num, image_id
    ), ins AS (
      INSERT INTO vc_keys (user_num, image_id)
      SELECT DISTINCT COALESCE(t.user_num, u.num_id), t.image_id
      FROM taken t LEFT JOIN users u ON u.id = t.user_id
      WHERE COALESCE(t.user_num, u.num_id) IS NOT NULL
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM taken)::int AS taken, (SELECT count(*) FROM ins)::int AS keys`,
  // Before touching votes_compact, take the row locks its foreign-key checks
  // would take anyway (KEY SHARE on the parent users/images rows), in key
  // order. A concurrent user/image delete then either finished already or
  // waits for us; taking them late (inside the INSERT's FK check) while
  // holding compact rows the delete's cascade wants is a deadlock.
  catchupLockParents: [
    `SELECT 1 FROM users WHERE num_id IN (SELECT user_num FROM vc_keys) ORDER BY num_id FOR KEY SHARE`,
    `SELECT 1 FROM images WHERE id IN (SELECT image_id FROM vc_keys WHERE image_id IS NOT NULL) ORDER BY id FOR KEY SHARE`,
  ],
  catchupDeleteKeys: `
    DELETE FROM votes_compact c USING vc_keys k
    WHERE k.image_id IS NOT NULL AND c.user_num = k.user_num AND c.image_id = k.image_id`,
  catchupDeleteUsers: `
    DELETE FROM votes_compact c USING vc_keys k
    WHERE k.image_id IS NULL AND c.user_num = k.user_num`,
  catchupInsert: `
    INSERT INTO votes_compact (user_num, image_id, is_up, created_at)
    SELECT k.user_num, k.image_id, ${VOTE_IS_UP}, v.created_at
    FROM vc_keys k
    JOIN users u ON u.num_id = k.user_num
    CROSS JOIN LATERAL ${LEGACY_ROW_BY_KEY('votes', 'u.id', 'k.image_id')} v
    WHERE k.image_id IS NOT NULL`,

  indexes: [
    {
      name: 'votes_compact_pkey',
      sql: `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS votes_compact_pkey ON votes_compact (user_num, image_id)`,
    },
    {
      name: 'idx_votes_compact_image',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_compact_image ON votes_compact (image_id)`,
    },
    {
      name: 'idx_votes_compact_user_up',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_compact_user_up ON votes_compact (user_num, created_at DESC) WHERE is_up`,
    },
  ],
  attachPk: `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'votes_compact'::regclass AND contype = 'p') THEN
        ALTER TABLE votes_compact ADD CONSTRAINT votes_compact_pkey PRIMARY KEY USING INDEX votes_compact_pkey;
      END IF;
    END $$`,
  fks: [
    {
      name: 'votes_compact_user_num_fkey',
      sql: `ALTER TABLE votes_compact ADD CONSTRAINT votes_compact_user_num_fkey
              FOREIGN KEY (user_num) REFERENCES users (num_id) ON DELETE CASCADE NOT VALID`,
    },
    {
      name: 'votes_compact_image_id_fkey',
      sql: `ALTER TABLE votes_compact ADD CONSTRAINT votes_compact_image_id_fkey
              FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE NOT VALID`,
    },
  ],
};

// ── Runtime ─────────────────────────────────────────────────────────────────

interface QueryResultLike<T> {
  rows: T[];
  rowCount: number;
}

interface Db {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<QueryResultLike<T>>;
  end(): Promise<void>;
}

interface Ctx {
  db: Db;
  opts: Options;
  dry: boolean;
  stopping: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function log(...args: unknown[]): void {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}]`, ...args);
}

function oneLine(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

class DryRunDb implements Db {
  async q<T>(sql: string, params?: unknown[]): Promise<QueryResultLike<T>> {
    const p = params && params.length ? `  -- params: ${JSON.stringify(params)}` : '';
    console.log(`${sql.trim().replace(/^\s{4}/gm, '')};${p}\n`);
    return { rows: [], rowCount: 0 };
  }
  async end(): Promise<void> {}
}

class PgDb implements Db {
  private client: pg.Client;
  constructor(client: pg.Client) {
    this.client = client;
  }
  async q<T>(sql: string, params?: unknown[]): Promise<QueryResultLike<T>> {
    const res = await this.client.query(sql, params);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  }
  async end(): Promise<void> {
    await this.client.end();
  }
}

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}

/** lock_timeout (55P03), deadlock (40P01), serialization (40001), FK race (23503). */
function isRetryable(err: unknown): boolean {
  const c = pgCode(err);
  return c === '55P03' || c === '40P01' || c === '40001' || c === '23503';
}

async function tx<T>(ctx: Ctx, fn: () => Promise<T>, lockTimeoutMs = ctx.opts.lockTimeoutMs, statementTimeoutMs = ctx.opts.statementTimeoutMs): Promise<T> {
  const { db } = ctx;
  await db.q('BEGIN');
  try {
    await db.q(`SET LOCAL lock_timeout = '${Math.floor(lockTimeoutMs)}ms'`);
    await db.q(`SET LOCAL statement_timeout = '${Math.floor(statementTimeoutMs)}ms'`);
    const out = await fn();
    await db.q('COMMIT');
    return out;
  } catch (err) {
    await db.q('ROLLBACK').catch(() => {});
    throw err;
  }
}

/** Runs fn (normally a short transaction) until it gets its locks. */
async function withRetry<T>(ctx: Ctx, label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt >= ctx.opts.maxAttempts || ctx.dry) throw err;
      const wait = Math.min(30_000, 2_000 * attempt);
      log(`${label}: ${(err as Error).message} (attempt ${attempt}/${ctx.opts.maxAttempts}), retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

/** Waits while the pause file exists or the host is overloaded. Returns false if we should stop. */
async function throttleGate(ctx: Ctx, deadline: Date | null): Promise<boolean> {
  const { opts } = ctx;
  let announced = 0;
  for (;;) {
    if (ctx.stopping) return false;
    if (deadline && Date.now() >= deadline.getTime()) {
      log(`--until ${opts.until} reached: stopping cleanly. Re-run the same command to resume.`);
      return false;
    }
    let reason = '';
    if (fs.existsSync(opts.pauseFile)) reason = `pause file ${opts.pauseFile} exists`;
    else if (opts.maxLoad > 0) {
      const cpus = os.cpus().length || 1;
      const load = os.loadavg()[0];
      if (load > opts.maxLoad * cpus) reason = `load ${load.toFixed(1)} > ${opts.maxLoad} x ${cpus} CPUs`;
    }
    if (!reason || ctx.dry) return true;
    if (Date.now() - announced > 60_000) {
      log(`waiting: ${reason}`);
      announced = Date.now();
    }
    await sleep(5_000);
  }
}

// Row of votes_compact_state; loosely typed because dry-run paths read it as null.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getState(ctx: Ctx): Promise<any | null> {
  if (ctx.dry) return null;
  const exists = await ctx.db.q<{ t: string | null }>(`SELECT to_regclass('votes_compact_state')::text AS t`);
  if (!exists.rows[0]?.t) return null;
  const res = await ctx.db.q(`SELECT * FROM votes_compact_state`);
  return res.rows[0] ?? null;
}

async function relExists(ctx: Ctx, name: string): Promise<boolean> {
  if (ctx.dry) return false;
  const res = await ctx.db.q<{ t: string | null }>(`SELECT to_regclass($1)::text AS t`, [name]);
  return !!res.rows[0]?.t;
}

async function columnsOf(ctx: Ctx, table: string): Promise<string[]> {
  if (ctx.dry) return [];
  const res = await ctx.db.q<{ attname: string }>(
    `SELECT attname FROM pg_attribute WHERE attrelid = to_regclass($1) AND attnum > 0 AND NOT attisdropped`,
    [table]
  );
  return res.rows.map((r) => r.attname);
}

/** Tables holding the legacy and the compact rows right now. */
async function tableNames(ctx: Ctx): Promise<{ legacy: string; compact: string; swapped: boolean }> {
  const votesCols = await columnsOf(ctx, 'votes');
  const swapped = votesCols.includes('user_num');
  return swapped
    ? { legacy: 'votes_old', compact: 'votes', swapped }
    : { legacy: 'votes', compact: 'votes_compact', swapped };
}

async function indexValid(ctx: Ctx, name: string): Promise<boolean | null> {
  if (ctx.dry) return null;
  const res = await ctx.db.q<{ valid: boolean }>(
    `SELECT i.indisvalid AS valid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = $1`,
    [name]
  );
  return res.rows.length ? res.rows[0].valid : null;
}

/** CREATE INDEX CONCURRENTLY, replacing a leftover INVALID index of a cancelled build. */
async function buildIndexConcurrently(ctx: Ctx, name: string, sql: string): Promise<void> {
  const valid = await indexValid(ctx, name);
  if (valid === true) {
    log(`index ${name}: already valid`);
    return;
  }
  if (valid === false) {
    log(`index ${name}: dropping INVALID leftover of a cancelled build`);
    await ctx.db.q(`DROP INDEX CONCURRENTLY IF EXISTS ${name}`);
  }
  log(`index ${name}: building (no throttle possible; watch pg_stat_progress_create_index)`);
  const t0 = Date.now();
  await ctx.db.q(sql);
  log(`index ${name}: done in ${formatDuration(Date.now() - t0)}`);
}

// ── Phases ──────────────────────────────────────────────────────────────────

async function phaseStatus(ctx: Ctx): Promise<void> {
  const st = await getState(ctx);
  const names = await tableNames(ctx);
  const sizes = await ctx.db.q<{ rel: string; total: string; heap: string; rows: string }>(
    `SELECT r AS rel,
            pg_total_relation_size(to_regclass(r))::text AS total,
            pg_relation_size(to_regclass(r))::text AS heap,
            (SELECT reltuples::bigint FROM pg_class WHERE oid = to_regclass(r))::text AS rows
     FROM unnest(ARRAY['votes','votes_old','votes_compact','votes_compact_log']) r
     WHERE to_regclass(r) IS NOT NULL`
  );
  log(`layout: votes is ${names.swapped ? 'COMPACT (swapped)' : 'legacy'}`);
  for (const s of sizes.rows) {
    log(`  ${s.rel.padEnd(18)} total ${formatBytes(Number(s.total)).padStart(9)}  heap ${formatBytes(Number(s.heap)).padStart(9)}  ~${Number(s.rows).toLocaleString()} rows`);
  }
  if (!st) {
    log('migration not prepared (no votes_compact_state)');
    return;
  }
  const pct = st.hwm ? ((Number(st.last_id) / Number(st.hwm)) * 100).toFixed(2) : '0';
  const logRows = await ctx.db.q<{ n: string }>(
    `SELECT CASE WHEN to_regclass('votes_compact_log') IS NULL THEN 0 ELSE (SELECT count(*) FROM votes_compact_log) END::text AS n`
  );
  log(`prepared ${st.prepared_at ?? '-'}; backfill ${st.backfill_done_at ? `done ${st.backfill_done_at}` : `${pct}%`} (id ${st.last_id} / hwm ${st.hwm ?? '-'}, ${Number(st.rows_copied).toLocaleString()} rows copied)`);
  log(`settled ${st.settled_at ?? '-'}; vacuumed ${st.vacuumed_at ?? '-'}; indexed ${st.indexed_at ?? '-'}; verified ${st.verified_at ?? '-'} (ok=${st.verify_ok ?? '-'}); swapped ${st.swapped_at ?? '-'}`);
  log(`change log: ${Number(logRows.rows[0]?.n ?? 0).toLocaleString()} pending rows`);
  const prog = await ctx.db.q(
    `SELECT pid, phase, blocks_done, blocks_total, tuples_done, tuples_total, (SELECT relname FROM pg_class WHERE oid = index_relid) AS idx
     FROM pg_stat_progress_create_index`
  );
  for (const p of prog.rows) log(`  index build in progress: ${p.idx} ${p.phase} blocks ${p.blocks_done}/${p.blocks_total} tuples ${p.tuples_done}/${p.tuples_total}`);
}

async function phasePrepare(ctx: Ctx): Promise<void> {
  const { db } = ctx;
  await requireConfirm(ctx, 'prepare');
  if (!ctx.dry) {
    const ver = await db.q<{ v: number }>(`SELECT current_setting('server_version_num')::int AS v`);
    if (ver.rows[0].v < 140000) throw new Error('PostgreSQL 14+ required (CREATE OR REPLACE TRIGGER, TID range scans)');
    const cols = await columnsOf(ctx, 'votes');
    if (cols.includes('user_num')) throw new Error('votes already has the compact layout (already swapped?)');
    for (const c of ['id', 'user_id', 'image_id', 'type', 'created_at']) {
      if (!cols.includes(c)) throw new Error(`votes.${c} missing: unexpected layout`);
    }
    if (await relExists(ctx, 'votes_old')) throw new Error('votes_old exists: finish or clean up the previous run first');
    const types = await db.q<{ vals: string | null }>(
      `SELECT most_common_vals::text AS vals FROM pg_stats WHERE tablename = 'votes' AND attname = 'type'`
    );
    const vals = types.rows[0]?.vals;
    if (vals && vals.replace(/[{}"]/g, '').split(',').some((v) => v !== 'upvote' && v !== 'downvote')) {
      throw new Error(`votes.type has values other than upvote/downvote (${vals}); the backfill would fail on them`);
    }
  }

  log('users.num_id: sequence, column, default');
  await db.q(SQL.numIdSeq);
  await withRetry(ctx, 'users.num_id column', () => tx(ctx, () => db.q(SQL.numIdColumn)));
  await withRetry(ctx, 'users.num_id default', () => tx(ctx, () => db.q(SQL.numIdDefault)));
  await db.q(SQL.numIdOwned);
  const filled = await withRetry(ctx, 'users.num_id fill', () => tx(ctx, () => db.q(SQL.numIdFill)));
  log(`users.num_id: assigned ${filled.rowCount} users`);
  if ((await indexValid(ctx, 'users_num_id_key')) === false) {
    await db.q(`DROP INDEX CONCURRENTLY IF EXISTS users_num_id_key`);
  }
  await db.q(`SET lock_timeout = 0`);
  await db.q(SQL.numIdIndex);
  await db.q(`SET lock_timeout = '${ctx.opts.lockTimeoutMs}ms'`);
  await withRetry(ctx, 'users.num_id NOT NULL', () => tx(ctx, () => db.q(SQL.numIdNotNull)));
  await withRetry(ctx, 'users.num_id unique constraint', () => tx(ctx, () => db.q(SQL.numIdConstraint)));

  log('tables: votes_compact, votes_compact_log, votes_compact_settle, votes_compact_state');
  await db.q(SQL.createCompact);
  await db.q(SQL.createLog);
  await db.q(SQL.createSettle);
  await db.q(SQL.createState);
  await db.q(SQL.initState);
  const st = await getState(ctx);
  if (st?.swapped_at) throw new Error('already swapped');

  log('change-log triggers on votes and users (one transaction)');
  await db.q(SQL.logFn);
  await db.q(SQL.logUsersFn);
  await db.q(SQL.noTruncateFn);
  await withRetry(ctx, 'create triggers', () =>
    tx(ctx, async () => {
      for (const t of SQL.forwardTriggers) await db.q(t);
      await db.q(`UPDATE votes_compact_state SET prepared_at = COALESCE(prepared_at, now()), updated_at = now()`);
    })
  );
  log('prepare done. Every vote change is now logged; next: backfill');
}

async function phaseBackfill(ctx: Ctx): Promise<void> {
  const { db, opts } = ctx;
  let st = await getState(ctx);
  if (!ctx.dry) {
    if (!st?.prepared_at) throw new Error('run prepare first');
    if (st.swapped_at) throw new Error('already swapped');
    if (st.settle_pages !== null) throw new Error('backfill already finished and settling started');
  }
  if (ctx.dry || st.hwm === null) {
    // Rows above the high-water mark were all inserted after prepare, so the
    // change log covers them.
    const r = await db.q<{ hwm: number }>(
      `UPDATE votes_compact_state SET hwm = (SELECT COALESCE(max(id), 0) FROM votes), backfill_started_at = now(), updated_at = now()
       WHERE hwm IS NULL RETURNING hwm`
    );
    if (!ctx.dry) {
      st = { ...st, hwm: r.rows[0]?.hwm ?? st.hwm };
      log(`backfill: high-water mark votes.id = ${st.hwm}`);
    }
  }
  const hwm = ctx.dry ? 1_000_000 : Number(st.hwm);
  let lastId = ctx.dry ? 0 : Number(st.last_id);
  if (lastId >= hwm) {
    if (!ctx.dry && !st.backfill_done_at) await db.q(`UPDATE votes_compact_state SET backfill_done_at = now()`);
    log('backfill: already complete');
    return;
  }

  const deadline = opts.until ? parseUntil(opts.until, new Date()) : null;
  if (deadline) log(`backfill: will stop at ${deadline.toString()}`);
  let target = opts.batchSize;
  let windowIds = opts.batchSize;
  let batches = 0;
  let copied = 0;
  const startId = lastId;
  const t0 = Date.now();
  let lastReport = 0;

  while (lastId < hwm) {
    if (!(await throttleGate(ctx, deadline))) break;
    if (opts.maxBatches && batches >= opts.maxBatches) {
      log(`--max-batches ${opts.maxBatches} reached`);
      break;
    }
    const to = Math.min(hwm, lastId + windowIds);
    const started = Date.now();
    const rows = await withRetry(ctx, 'backfill batch', () =>
      tx(ctx, async () => {
        // Row-locks the state row: a second runner would block here.
        const cur = await db.q<{ last_id: number }>(`SELECT last_id FROM votes_compact_state FOR UPDATE`);
        if (!ctx.dry && Number(cur.rows[0].last_id) !== lastId) {
          throw new Error(`checkpoint moved (another backfill running?): expected ${lastId}, found ${cur.rows[0].last_id}`);
        }
        const ins = await db.q(SQL.backfillBatch, [lastId, to]);
        await db.q(SQL.backfillCheckpoint, [to, ins.rowCount]);
        return ins.rowCount;
      })
    );
    const elapsed = Date.now() - started;
    batches++;
    copied += rows;
    lastId = to;
    if (ctx.dry) break;

    target = adjustBatchTarget(target, elapsed, opts.maxBatchMs, opts.batchSize);
    windowIds = nextWindow(windowIds, rows, target, opts.batchSize * 64);
    const pause = computeSleepMs(rows, elapsed, opts.maxRowsPerSec, opts.sleepMs);
    if (elapsed > opts.maxBatchMs) log(`backfill: slow batch (${elapsed} ms for ${rows} rows), target now ${target} rows`);

    if (Date.now() - lastReport > 30_000 || lastId >= hwm) {
      lastReport = Date.now();
      const rate = copied / ((Date.now() - t0) / 1000);
      const rowsPerId = copied / Math.max(1, lastId - startId);
      const etaMs = (((hwm - lastId) * rowsPerId) / Math.max(rate, 1)) * 1000;
      log(`backfill: id ${lastId.toLocaleString()} / ${hwm.toLocaleString()} (${((lastId / hwm) * 100).toFixed(2)}%), ` +
        `${copied.toLocaleString()} rows this run, ${rate.toFixed(0)} rows/s, last batch ${rows} rows in ${elapsed} ms, ETA ~${formatDuration(etaMs)}`);
    }
    if (lastId < hwm) await sleep(pause);
  }
  if (lastId >= hwm) log(`backfill: complete (${copied.toLocaleString()} rows this run). Next: index`);
  else log(`backfill: paused at id ${lastId}. Re-run to resume.`);
}

async function catchupOnce(ctx: Ctx, limit: number): Promise<{ taken: number; keys: number }> {
  const { db } = ctx;
  return tx(ctx, async () => {
    const r = await db.q<{ taken: number; keys: number }>(SQL.catchupTake, [limit]);
    const taken = r.rows[0]?.taken ?? 0;
    if (taken > 0 || ctx.dry) {
      for (const sql of SQL.catchupLockParents) await db.q(sql);
      await db.q(SQL.catchupDeleteKeys);
      await db.q(SQL.catchupDeleteUsers);
      await db.q(SQL.catchupInsert);
    }
    return { taken, keys: r.rows[0]?.keys ?? 0 };
  });
}

/**
 * Applies logged changes in --catchup-batch transactions until a batch comes
 * back partly empty, i.e. the backlog is gone and only live trickle remains
 * (a strict "until empty" never ends while votes keep arriving).
 */
async function drainLog(ctx: Ctx, deadline: Date | null = null): Promise<number> {
  await ctx.db.q(SQL.catchupKeysTable);
  let total = 0;
  for (;;) {
    if (!(await throttleGate(ctx, deadline))) break;
    const { taken } = await withRetry(ctx, 'catchup', () => catchupOnce(ctx, ctx.opts.catchupBatch));
    total += taken;
    if (ctx.dry || taken < ctx.opts.catchupBatch) break;
    await sleep(ctx.opts.sleepMs);
  }
  return total;
}

async function phaseIndex(ctx: Ctx): Promise<void> {
  const { db, opts } = ctx;
  let st = await getState(ctx);
  if (!ctx.dry) {
    if (!st?.backfill_done_at) throw new Error('backfill not complete');
    if (st.swapped_at) throw new Error('already swapped');
  }
  const deadline = opts.until ? parseUntil(opts.until, new Date()) : null;

  // 1. Settle: rows changed during the backfill may be stale or duplicated in
  //    votes_compact. Remove every copy of each logged key, then re-insert
  //    its current row. Done before the unique index exists, so the delete is
  //    a throttled heap scan in TID-range chunks.
  if (ctx.dry || !st.settled_at) {
    if (ctx.dry || st.settle_pages === null) {
      await withRetry(ctx, 'settle capture', () =>
        tx(ctx, async () => {
          const r = await db.q(SQL.settleCapture);
          await db.q(
            `UPDATE votes_compact_state SET settle_page = 0,
               settle_pages = pg_relation_size('votes_compact') / current_setting('block_size')::int, updated_at = now()`
          );
          log(`settle: captured ${r.rowCount} changed keys`);
        }, opts.lockTimeoutMs, 0)
      );
      await db.q(`ANALYZE votes_compact_settle`);
      st = await getState(ctx);
    }
    let page = ctx.dry ? 0 : Number(st.settle_page);
    const pages = ctx.dry ? 1 : Number(st.settle_pages);
    let removed = 0;
    while (page < pages) {
      if (!(await throttleGate(ctx, deadline))) return;
      const to = Math.min(pages, page + opts.settlePages);
      const started = Date.now();
      // The final chunk is open-ended: nothing appends to votes_compact now,
      // but be safe about the relation having grown.
      const toTid = to >= pages ? tidAt(2 ** 32 - 1) : tidAt(to);
      const n = await withRetry(ctx, 'settle chunk', () =>
        tx(ctx, async () => {
          const a = await db.q(SQL.settleDeleteKeys, [tidAt(page), toTid]);
          const b = await db.q(SQL.settleDeleteUsers, [tidAt(page), toTid]);
          await db.q(`UPDATE votes_compact_state SET settle_page = $1, updated_at = now()`, [to]);
          return a.rowCount + b.rowCount;
        })
      );
      removed += n;
      page = to;
      if (ctx.dry) break;
      const elapsed = Date.now() - started;
      if (page % (opts.settlePages * 32) < opts.settlePages || page >= pages) {
        log(`settle: page ${page.toLocaleString()} / ${pages.toLocaleString()}, removed ${removed} stale copies`);
      }
      // At most ~50% duty cycle on the heap scan.
      await sleep(Math.max(opts.sleepMs, elapsed));
    }
    let reinserted = 0;
    for (;;) {
      if (!(await throttleGate(ctx, deadline))) return;
      const n = await withRetry(ctx, 'settle reinsert', () =>
        tx(ctx, async () => (await db.q(SQL.settleReinsert, [opts.catchupBatch])).rowCount)
      );
      reinserted += n;
      if (ctx.dry) break;
      const left = await db.q<{ n: number }>(`SELECT count(*)::int AS n FROM votes_compact_settle WHERE image_id IS NOT NULL`);
      if (left.rows[0].n === 0) break;
      await sleep(opts.sleepMs);
    }
    await withRetry(ctx, 'settle finish', () =>
      tx(ctx, async () => {
        await db.q(`DELETE FROM votes_compact_settle`);
        await db.q(`UPDATE votes_compact_state SET settled_at = now(), updated_at = now()`);
      })
    );
    log(`settle: re-inserted ${reinserted} current rows`);
  } else {
    log('settle: already done');
  }

  // 2. VACUUM before the index builds: one throttled heap pass that sets hint
  //    bits / visibility map and freezes, so the builds read clean pages and
  //    no later anti-wraparound vacuum has to rewrite the table.
  st = await getState(ctx);
  if (ctx.dry || !st.vacuumed_at) {
    if (!(await throttleGate(ctx, deadline))) return;
    log(`vacuum: VACUUM (FREEZE, ANALYZE) votes_compact, cost delay ${opts.vacuumCostDelayMs} ms / limit ${opts.vacuumCostLimit}`);
    const t0 = Date.now();
    await db.q(`SET statement_timeout = 0`);
    await db.q(`SET vacuum_cost_delay = '${opts.vacuumCostDelayMs}ms'`);
    await db.q(`SET vacuum_cost_limit = ${Math.floor(opts.vacuumCostLimit)}`);
    await db.q(`VACUUM (FREEZE, ANALYZE) votes_compact`);
    await db.q(`SET statement_timeout = '${opts.statementTimeoutMs}ms'`);
    await db.q(`UPDATE votes_compact_state SET vacuumed_at = now(), updated_at = now()`);
    log(`vacuum: done in ${formatDuration(Date.now() - t0)}`);
  } else {
    log('vacuum: already done');
  }

  // 3. Indexes. CREATE INDEX CONCURRENTLY cannot be throttled; one at a time,
  //    single process unless --parallel-workers.
  if (!(await throttleGate(ctx, deadline))) return;
  await db.q(`SET statement_timeout = 0`);
  await db.q(`SET lock_timeout = 0`); // CIC waits for older transactions; a timeout would leave an INVALID index
  await db.q(`SET maintenance_work_mem = '${opts.maintenanceWorkMem}'`);
  await db.q(`SET max_parallel_maintenance_workers = ${Math.floor(opts.parallelWorkers)}`);
  for (const idx of SQL.indexes) {
    if (!(await throttleGate(ctx, deadline))) return;
    try {
      await buildIndexConcurrently(ctx, idx.name, idx.sql);
    } catch (err) {
      if (pgCode(err) === '23505' && idx.name === 'votes_compact_pkey') {
        await db.q(`DROP INDEX CONCURRENTLY IF EXISTS votes_compact_pkey`);
        const dups = await db.q(
          `SELECT user_num, image_id, count(*) FROM votes_compact GROUP BY 1, 2 HAVING count(*) > 1 LIMIT 20`
        );
        console.error('Duplicate (user_num, image_id) keys in votes_compact:', dups.rows);
        throw new Error('votes_compact has duplicate keys: this is a bug in the settle step. Do not swap; run abort and report.');
      }
      throw err;
    }
    if (idx.name === 'votes_compact_pkey') {
      await db.q(`SET lock_timeout = '${opts.lockTimeoutMs}ms'`);
      await withRetry(ctx, 'attach primary key', () => tx(ctx, () => db.q(SQL.attachPk)));
      await db.q(`SET lock_timeout = 0`);
    }
  }
  await db.q(`SET statement_timeout = '${opts.statementTimeoutMs}ms'`);
  await db.q(`SET lock_timeout = '${opts.lockTimeoutMs}ms'`);

  // 4. Foreign keys, NOT VALID: enforced for new rows and cascades work at
  //    once; validating the existing rows is the optional validate-fk phase.
  for (const fk of SQL.fks) {
    const exists = ctx.dry ? { rows: [] } : await db.q(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [fk.name]);
    if (exists.rows.length) continue;
    await withRetry(ctx, fk.name, () => tx(ctx, () => db.q(fk.sql)));
    log(`foreign key ${fk.name} added (NOT VALID)`);
  }
  await withRetry(ctx, 'enable autovacuum', () =>
    tx(ctx, () => db.q(`ALTER TABLE votes_compact RESET (autovacuum_enabled)`))
  );
  await db.q(`UPDATE votes_compact_state SET indexed_at = COALESCE(indexed_at, now()), updated_at = now()`);

  // 5. Apply everything logged since the settle capture.
  const n = await drainLog(ctx, deadline);
  log(`index phase done; applied ${n} logged changes. Next: verify (and catchup --follow until the swap)`);
}

async function phaseCatchup(ctx: Ctx): Promise<void> {
  const st = await getState(ctx);
  if (!ctx.dry) {
    if (!st?.indexed_at) throw new Error('run the index phase first (catchup needs the primary key)');
    if (st.swapped_at) throw new Error('already swapped: nothing to catch up');
  }
  const deadline = ctx.opts.until ? parseUntil(ctx.opts.until, new Date()) : null;
  for (;;) {
    const n = await drainLog(ctx, deadline);
    if (n) log(`catchup: applied ${n} logged changes`);
    if (!ctx.opts.follow || ctx.dry || ctx.stopping || (deadline && Date.now() >= deadline.getTime())) break;
    await sleep(Math.max(1_000, ctx.opts.sleepMs * 4));
  }
}

interface VerifyResult {
  ok: boolean;
  problems: string[];
}

async function phaseVerify(ctx: Ctx): Promise<VerifyResult> {
  const { db, opts } = ctx;
  const problems: string[] = [];
  const st = await getState(ctx);
  const names = await tableNames(ctx);
  const L = names.legacy;
  const C = names.compact;
  if (!ctx.dry) {
    if (!st?.indexed_at) throw new Error('run the index phase first');
    if (!names.swapped) {
      const n = await drainLog(ctx);
      log(`verify: drained ${n} pending log rows first`);
    }
  }

  // Structure
  for (const idx of SQL.indexes) {
    const v = await indexValid(ctx, idx.name);
    if (v !== true && !ctx.dry) problems.push(`index ${idx.name} missing or invalid`);
  }
  if (!ctx.dry) {
    const pk = await db.q(`SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass($1) AND contype = 'p'`, [C]);
    if (!pk.rows.length) problems.push(`${C} has no primary key`);
    for (const fk of SQL.fks) {
      const r = await db.q(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [fk.name]);
      if (!r.rows.length) problems.push(`foreign key ${fk.name} missing`);
    }
    if (names.swapped) {
      const t = await db.q(`SELECT 1 FROM pg_trigger WHERE tgname = 'votes_compact_reverse_mirror'`);
      if (!t.rows.length) log('verify: note: no reverse mirror trigger, votes_old is not kept current (rollback would lose votes)');
    } else {
      const t = await db.q(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid = 'votes'::regclass AND tgname LIKE 'votes_compact_log_%'`);
      if (t.rows[0].n !== 3) problems.push('change-log triggers on votes missing');
    }
  }

  // Estimated totals
  const est = await db.q<{ rel: string; n: string }>(
    `SELECT r AS rel, (SELECT reltuples::bigint FROM pg_class WHERE oid = to_regclass(r))::text AS n FROM unnest($1::text[]) r`,
    [[L, C]]
  );
  for (const r of est.rows) log(`verify: ${r.rel} ~${Number(r.n).toLocaleString()} rows (planner estimate)`);

  const pending = async (keys: { user_num: number; image_id: number }[]): Promise<Set<string>> => {
    if (names.swapped || !keys.length) return new Set();
    const r = await db.q<{ k: string }>(
      `SELECT u.num_id || ':' || l.image_id AS k FROM votes_compact_log l JOIN users u ON u.id = l.user_id
       WHERE (u.num_id, l.image_id) IN (SELECT * FROM unnest($1::int[], $2::int[]))`,
      [keys.map((k) => k.user_num), keys.map((k) => k.image_id)]
    );
    return new Set(r.rows.map((x) => x.k));
  };

  /** Re-reads mismatched keys a moment later; returns those still different. */
  const recheck = async (keys: { user_num: number; image_id: number }[]): Promise<{ user_num: number; image_id: number }[]> => {
    if (!keys.length) return [];
    await sleep(1_000);
    if (!names.swapped) await drainLog(ctx);
    const r = await db.q<{ user_num: number; image_id: number; l_up: boolean | null; l_at: string | null; c_up: boolean | null; c_at: string | null }>(
      `SELECT k.user_num, k.image_id,
              CASE l.type WHEN 'upvote' THEN true WHEN 'downvote' THEN false END AS l_up, l.created_at::text AS l_at,
              c.is_up AS c_up, c.created_at::text AS c_at
       FROM unnest($1::int[], $2::int[]) AS k(user_num, image_id)
       LEFT JOIN users u ON u.num_id = k.user_num
       LEFT JOIN LATERAL ${LEGACY_ROW_BY_KEY(L, 'u.id', 'k.image_id')} l ON true
       LEFT JOIN LATERAL ${COMPACT_ROW_BY_KEY(C, 'k.user_num', 'k.image_id')} c ON true`,
      [keys.map((k) => k.user_num), keys.map((k) => k.image_id)]
    );
    const still = r.rows.filter((x) => x.l_up !== x.c_up || x.l_at !== x.c_at);
    const pend = await pending(still);
    return still.filter((x) => !pend.has(`${x.user_num}:${x.image_id}`));
  };

  // Random rows, both directions (TABLESAMPLE SYSTEM reads ~sampleRows/100 pages).
  if (!ctx.dry) {
    const sampleDir = async (from: 'legacy' | 'compact') => {
      const rel = from === 'legacy' ? L : C;
      const tuples = Number(est.rows.find((r) => r.rel === rel)?.n ?? 0);
      const pct = Math.min(100, Math.max(0.0001, (opts.sampleRows / Math.max(tuples, 1)) * 100 * 1.5));
      const rows = await db.q<{ user_num: number; image_id: number; l_up: boolean | null; l_at: string | null; c_up: boolean | null; c_at: string | null }>(
        from === 'legacy'
          ? `SELECT u.num_id AS user_num, s.image_id,
                    CASE s.type WHEN 'upvote' THEN true WHEN 'downvote' THEN false END AS l_up, s.created_at::text AS l_at,
                    c.is_up AS c_up, c.created_at::text AS c_at
             FROM (SELECT * FROM ${L} TABLESAMPLE SYSTEM (${pct.toFixed(6)}) LIMIT ${opts.sampleRows}) s
             JOIN users u ON u.id = s.user_id
             LEFT JOIN LATERAL ${COMPACT_ROW_BY_KEY(C, 'u.num_id', 's.image_id')} c ON true`
          : `SELECT s.user_num, s.image_id,
                    CASE l.type WHEN 'upvote' THEN true WHEN 'downvote' THEN false END AS l_up, l.created_at::text AS l_at,
                    s.is_up AS c_up, s.created_at::text AS c_at
             FROM (SELECT * FROM ${C} TABLESAMPLE SYSTEM (${pct.toFixed(6)}) LIMIT ${opts.sampleRows}) s
             LEFT JOIN users u ON u.num_id = s.user_num
             LEFT JOIN LATERAL ${LEGACY_ROW_BY_KEY(L, 'u.id', 's.image_id')} l ON true`
      );
      const bad = rows.rows.filter((x) => x.l_up !== x.c_up || x.l_at !== x.c_at);
      const persistent = await recheck(bad);
      log(`verify: ${rows.rows.length} random ${from} rows checked, ${bad.length} differed, ${persistent.length} still differ after recheck`);
      for (const p of persistent.slice(0, 10)) problems.push(`row ${from}->other differs: user_num=${p.user_num} image_id=${p.image_id}`);
      if (persistent.length > 10) problems.push(`... and ${persistent.length - 10} more ${from} rows`);
    };
    await sampleDir('legacy');
    await sampleDir('compact');

    // Whole users: exact content hash of all their votes on both sides.
    const users = await db.q<{ id: string; num_id: number }>(
      `SELECT id, num_id FROM users WHERE num_id IS NOT NULL ORDER BY random() LIMIT $1`,
      [opts.sampleUsers * 3]
    );
    let checkedUsers = 0;
    for (const u of users.rows) {
      if (checkedUsers >= opts.sampleUsers) break;
      const cnt = await db.q<{ n: number }>(`SELECT count(*)::int AS n FROM ${C} WHERE user_num = $1`, [u.num_id]);
      if (cnt.rows[0].n > opts.maxUserRows) continue;
      // One statement = one snapshot for both sides. Before the swap, keys
      // with a change still waiting in the log are left out (they are
      // allowed to differ until the next catchup).
      const pendingSql = names.swapped
        ? `SELECT NULL::int AS image_id WHERE false`
        : `SELECT image_id FROM votes_compact_log WHERE user_id = $1 AND image_id IS NOT NULL`;
      const hashBoth = async () =>
        (await db.q<{ ln: number; lup: number; lh: string | null; cn: number; cup: number; ch: string | null }>(
          `WITH pend AS (${pendingSql}),
           a AS (
             SELECT count(*)::int AS n, count(*) FILTER (WHERE type = 'upvote')::int AS up,
                    md5(string_agg(image_id::text || ':' || type || ':' || created_at::text, ',' ORDER BY image_id)) AS h
             FROM ${L} WHERE user_id = $1 AND image_id NOT IN (SELECT image_id FROM pend)
           ),
           c AS (
             SELECT count(*)::int AS n, count(*) FILTER (WHERE is_up)::int AS up,
                    md5(string_agg(image_id::text || ':' || CASE WHEN is_up THEN 'upvote' ELSE 'downvote' END || ':' || created_at::text, ',' ORDER BY image_id)) AS h
             FROM ${C} WHERE user_num = $2 AND image_id NOT IN (SELECT image_id FROM pend)
           )
           SELECT a.n AS ln, a.up AS lup, a.h AS lh, c.n AS cn, c.up AS cup, c.h AS ch FROM a, c`,
          [u.id, u.num_id]
        )).rows[0];
      const r = await hashBoth();
      checkedUsers++;
      if (r.lh !== r.ch) {
        problems.push(`user ${u.id} (num ${u.num_id}): legacy ${r.ln} votes/${r.lup} up vs compact ${r.cn}/${r.cup}`);
      }
    }
    log(`verify: ${checkedUsers} whole users compared (users with > ${opts.maxUserRows} votes skipped)`);

    // Orphans: user_num without a users row (loose index scan over the PK).
    const orphans = await db.q<{ n: number }>(
      `WITH RECURSIVE t AS (
         SELECT min(user_num) AS n FROM ${C}
         UNION ALL
         SELECT (SELECT min(user_num) FROM ${C} WHERE user_num > t.n) FROM t WHERE t.n IS NOT NULL
       )
       SELECT n FROM t WHERE n IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE num_id = t.n)`
    );
    if (orphans.rows.length) problems.push(`user_num values without a user: ${orphans.rows.map((r) => r.n).join(', ')}`);
    log(`verify: orphan user_num check: ${orphans.rows.length} found`);

    if (opts.full) await verifyFull(ctx, L, C, problems);
  }

  const ok = problems.length === 0;
  if (!ctx.dry) {
    await db.q(`UPDATE votes_compact_state SET verified_at = now(), verify_ok = $1, updated_at = now()`, [ok]);
  }
  if (ok) log('verify: OK');
  else {
    log(`verify: ${problems.length} problem(s):`);
    for (const p of problems) log(`  - ${p}`);
  }
  return { ok, problems };
}

/**
 * Every legacy row must exist identically in the compact table, and the
 * counts must match (together: the tables are equal). Walks the legacy table
 * in id windows with the backfill throttle.
 */
async function verifyFull(ctx: Ctx, L: string, C: string, problems: string[]): Promise<void> {
  const { db, opts } = ctx;
  const deadline = opts.until ? parseUntil(opts.until, new Date()) : null;
  const max = await db.q<{ m: number }>(`SELECT COALESCE(max(id), 0) AS m FROM ${L}`);
  const hwm = Number(max.rows[0].m);
  let last = 0;
  let windowIds = opts.batchSize;
  let legacyRows = 0;
  let mismatched: { user_num: number; image_id: number }[] = [];
  const t0 = Date.now();
  let lastReport = 0;
  while (last < hwm) {
    if (!(await throttleGate(ctx, deadline))) {
      problems.push('full verify interrupted before the end');
      return;
    }
    const to = Math.min(hwm, last + windowIds);
    const started = Date.now();
    const r = await db.q<{ n: number; bad: { user_num: number; image_id: number }[] | null }>(
      `SELECT count(*)::int AS n,
              json_agg(json_build_object('user_num', u.num_id, 'image_id', v.image_id))
                FILTER (WHERE c.is_up IS NULL OR c.is_up IS DISTINCT FROM (${VOTE_IS_UP}) OR c.created_at <> v.created_at) AS bad
       FROM ${L} v JOIN users u ON u.id = v.user_id
       LEFT JOIN LATERAL ${COMPACT_ROW_BY_KEY(C, 'u.num_id', 'v.image_id')} c ON true
       WHERE v.id > $1 AND v.id <= $2`,
      [last, to]
    );
    legacyRows += r.rows[0].n;
    if (r.rows[0].bad) mismatched.push(...r.rows[0].bad);
    if (mismatched.length > 1000) mismatched = await recheckPersistent(ctx, L, C, mismatched);
    const elapsed = Date.now() - started;
    windowIds = nextWindow(windowIds, r.rows[0].n, opts.batchSize, opts.batchSize * 64);
    last = to;
    if (Date.now() - lastReport > 30_000) {
      lastReport = Date.now();
      log(`verify --full: id ${last} / ${hwm}, ${legacyRows.toLocaleString()} rows, ${mismatched.length} pending mismatches, ${(legacyRows / ((Date.now() - t0) / 1000)).toFixed(0)} rows/s`);
    }
    await sleep(computeSleepMs(r.rows[0].n, elapsed, opts.maxRowsPerSec * 2, opts.sleepMs));
  }
  mismatched = await recheckPersistent(ctx, L, C, mismatched);
  for (const m of mismatched.slice(0, 20)) problems.push(`full: legacy row missing/different in compact: user_num=${m.user_num} image_id=${m.image_id}`);
  if (mismatched.length > 20) problems.push(`full: ... ${mismatched.length - 20} more`);

  // Counts in one snapshot. Before the swap, keys with a change still in the
  // log are excluded on both sides: every other key must be identical, so
  // the remaining counts must match exactly even while votes keep arriving.
  const swapped = L === 'votes_old';
  const counts = await db.q<{ l: string; c: string; pending: string }>(
    swapped
      ? `SELECT (SELECT count(*) FROM ${L})::text AS l, (SELECT count(*) FROM ${C})::text AS c, '0' AS pending`
      : `WITH lk AS (
           SELECT DISTINCT l.user_id, u.num_id, l.image_id
           FROM votes_compact_log l LEFT JOIN users u ON u.id = l.user_id
           WHERE l.image_id IS NOT NULL
         ), lu AS (
           SELECT DISTINCT user_num FROM votes_compact_log WHERE image_id IS NULL AND user_num IS NOT NULL
         )
         SELECT (SELECT count(*) FROM ${L} v
                 WHERE NOT EXISTS (SELECT 1 FROM lk WHERE lk.user_id = v.user_id AND lk.image_id = v.image_id))::text AS l,
                (SELECT count(*) FROM ${C} c
                 WHERE NOT EXISTS (SELECT 1 FROM lk WHERE lk.num_id = c.user_num AND lk.image_id = c.image_id)
                   AND NOT EXISTS (SELECT 1 FROM lu WHERE lu.user_num = c.user_num))::text AS c,
                (SELECT count(*) FROM lk)::text AS pending`
  );
  const cr = counts.rows[0];
  log(`verify --full: ${L} ${cr.l} rows, ${C} ${cr.c} rows (excluding ${cr.pending} keys pending in the log)`);
  if (cr.l !== cr.c) problems.push(`full: row counts differ (${L} ${cr.l}, ${C} ${cr.c})`);
}

async function recheckPersistent(ctx: Ctx, L: string, C: string, keys: { user_num: number; image_id: number }[]): Promise<{ user_num: number; image_id: number }[]> {
  if (!keys.length) return keys;
  await sleep(1_000);
  if (L === 'votes') await drainLog(ctx);
  const r = await ctx.db.q<{ user_num: number; image_id: number }>(
    `SELECT k.user_num, k.image_id
     FROM unnest($1::int[], $2::int[]) AS k(user_num, image_id)
     LEFT JOIN users u ON u.num_id = k.user_num
     LEFT JOIN LATERAL ${LEGACY_ROW_BY_KEY(L, 'u.id', 'k.image_id')} v ON true
     LEFT JOIN LATERAL ${COMPACT_ROW_BY_KEY(C, 'k.user_num', 'k.image_id')} c ON true
     WHERE (CASE v.type WHEN 'upvote' THEN true WHEN 'downvote' THEN false END) IS DISTINCT FROM c.is_up
        OR v.created_at IS DISTINCT FROM c.created_at`,
    [keys.map((k) => k.user_num), keys.map((k) => k.image_id)]
  );
  return r.rows;
}

async function requireConfirm(ctx: Ctx, action: string): Promise<void> {
  if (ctx.dry) return;
  const db = await ctx.db.q<{ d: string }>(`SELECT current_database() AS d`);
  const name = db.rows[0].d;
  if (ctx.opts.confirm !== name) {
    throw new Error(`${action} changes what the live app reads. Re-run with --confirm ${name}`);
  }
}

async function phaseSwap(ctx: Ctx): Promise<void> {
  const { db, opts } = ctx;
  await requireConfirm(ctx, 'swap');
  const st = await getState(ctx);
  if (!ctx.dry) {
    if (!st?.indexed_at) throw new Error('index phase not complete');
    if (st.swapped_at || (await tableNames(ctx)).swapped) throw new Error('already swapped');
    for (const idx of SQL.indexes) {
      if ((await indexValid(ctx, idx.name)) !== true) throw new Error(`index ${idx.name} missing or invalid`);
    }
    const fresh = st.verified_at && Date.now() - new Date(st.verified_at).getTime() < 48 * 3600_000;
    if (!(st.verify_ok && fresh) && !opts.force) {
      throw new Error('no passing verify in the last 48 h (run verify, or pass --force)');
    }
    log('swap: draining the change log before taking locks');
    await drainLog(ctx);
  }

  await db.q(SQL.catchupKeysTable);
  await db.q(SQL.reverseFn);
  for (let attempt = 1; ; attempt++) {
    try {
      const t0 = Date.now();
      const applied = await tx(ctx, async () => {
        // Blocks every reader and writer of votes until COMMIT; lock_timeout
        // bounds how long requests queue behind us if the lock is busy.
        await db.q(`LOCK TABLE votes IN ACCESS EXCLUSIVE MODE`);
        await db.q(`LOCK TABLE votes_compact IN ACCESS EXCLUSIVE MODE`);
        let total = 0;
        for (;;) {
          const r = await db.q<{ taken: number }>(SQL.catchupTake, [100_000]);
          const taken = r.rows[0]?.taken ?? 0;
          if (taken === 0 && !ctx.dry) break;
          for (const sql of SQL.catchupLockParents) await db.q(sql);
          await db.q(SQL.catchupDeleteKeys);
          await db.q(SQL.catchupDeleteUsers);
          await db.q(SQL.catchupInsert);
          await db.q(`TRUNCATE vc_keys`);
          total += taken;
          if (ctx.dry) break;
        }
        await db.q(`ALTER TABLE votes RENAME TO votes_old`);
        await db.q(`ALTER TABLE votes_compact RENAME TO votes`);
        for (const s of SQL.dropForwardTriggersOn('votes_old')) await db.q(s);
        if (opts.reverseMirror) await db.q(SQL.reverseTrigger);
        await db.q(`UPDATE votes_compact_state SET swapped_at = now(), updated_at = now()`);
        return total;
      }, opts.lockTimeoutMs, 30_000);
      if (ctx.dry) return;
      log(`swap: DONE in ${Date.now() - t0} ms (applied ${applied} final changes). votes is now compact; votes_old ${opts.reverseMirror ? 'is mirrored for rollback' : 'is NOT mirrored'}`);
      return;
    } catch (err) {
      if (!isRetryable(err) || attempt >= opts.maxAttempts || ctx.dry) throw err;
      const wait = Math.min(30_000, 3_000 * attempt);
      log(`swap: ${(err as Error).message} (attempt ${attempt}/${opts.maxAttempts}); nothing changed, retrying in ${wait / 1000}s`);
      await sleep(wait);
      await drainLog(ctx);
    }
  }
}

async function phaseRollback(ctx: Ctx): Promise<void> {
  const { db, opts } = ctx;
  await requireConfirm(ctx, 'rollback');
  if (!ctx.dry) {
    const names = await tableNames(ctx);
    if (!names.swapped) throw new Error('not swapped: use abort to undo a migration before the swap');
    if (!(await relExists(ctx, 'votes_old'))) throw new Error('votes_old is gone (cleanup ran): rollback impossible');
    const t = await db.q(`SELECT 1 FROM pg_trigger WHERE tgname = 'votes_compact_reverse_mirror'`);
    if (!t.rows.length && !opts.force) {
      throw new Error('votes_old was not mirrored after the swap; rolling back would lose newer votes (pass --force to accept)');
    }
  }
  await db.q(SQL.logFn);
  await db.q(SQL.noTruncateFn);
  await withRetry(ctx, 'rollback', () =>
    tx(ctx, async () => {
      await db.q(`LOCK TABLE votes IN ACCESS EXCLUSIVE MODE`);
      await db.q(`LOCK TABLE votes_old IN ACCESS EXCLUSIVE MODE`);
      await db.q(`DROP TRIGGER IF EXISTS votes_compact_reverse_mirror ON votes`);
      await db.q(`ALTER TABLE votes RENAME TO votes_compact`);
      await db.q(`ALTER TABLE votes_old RENAME TO votes`);
      for (const t of SQL.forwardTriggers) await db.q(t);
      await db.q(`UPDATE votes_compact_state SET swapped_at = NULL, verified_at = NULL, verify_ok = NULL, updated_at = now()`);
    }, opts.lockTimeoutMs, 30_000)
  );
  log('rollback: votes is legacy again; votes_compact is kept current through the change log (run catchup --follow, verify, swap to retry)');
}

async function phaseValidateFk(ctx: Ctx): Promise<void> {
  const { db } = ctx;
  await db.q(`SET statement_timeout = 0`);
  for (const fk of SQL.fks) {
    const r = ctx.dry
      ? { rows: [{ rel: 'votes_compact', valid: false }] }
      : await db.q<{ rel: string; valid: boolean }>(
          `SELECT conrelid::regclass::text AS rel, convalidated AS valid FROM pg_constraint WHERE conname = $1`,
          [fk.name]
        );
    if (!r.rows.length) throw new Error(`${fk.name} not found`);
    if (r.rows[0].valid) {
      log(`${fk.name}: already validated`);
      continue;
    }
    log(`${fk.name}: validating on ${r.rows[0].rel} (one full scan, writes are not blocked)`);
    const t0 = Date.now();
    await withRetry(ctx, fk.name, () => db.q(`ALTER TABLE ${r.rows[0].rel} VALIDATE CONSTRAINT ${fk.name}`));
    log(`${fk.name}: valid (${formatDuration(Date.now() - t0)})`);
  }
}

async function phaseCleanup(ctx: Ctx): Promise<void> {
  const { db, opts } = ctx;
  await requireConfirm(ctx, 'cleanup');
  const st = await getState(ctx);
  if (!ctx.dry) {
    if (!(await tableNames(ctx)).swapped) throw new Error('not swapped');
    const ageDays = st?.swapped_at ? (Date.now() - new Date(st.swapped_at).getTime()) / 86_400_000 : Infinity;
    if (ageDays < opts.minAgeDays && !opts.force) {
      throw new Error(`swapped ${ageDays.toFixed(1)} days ago; cleanup removes the rollback path (wait --min-age-days ${opts.minAgeDays} or --force)`);
    }
  }
  await withRetry(ctx, 'drop reverse mirror', () =>
    tx(ctx, () => db.q(`DROP TRIGGER IF EXISTS votes_compact_reverse_mirror ON votes`))
  );
  await withRetry(ctx, 'drop users log trigger', () =>
    tx(ctx, () => db.q(`DROP TRIGGER IF EXISTS votes_compact_log_users ON users`))
  );
  if (ctx.dry || (await relExists(ctx, 'votes_old'))) {
    // Drop the FKs first, one short lock on users/images each, so DROP TABLE
    // itself only needs votes_old.
    const fks = ctx.dry
      ? { rows: [{ conname: '<each foreign key of votes_old>' }] }
      : await db.q<{ conname: string }>(`SELECT conname FROM pg_constraint WHERE conrelid = 'votes_old'::regclass AND contype = 'f'`);
    for (const fk of fks.rows) {
      await withRetry(ctx, `drop ${fk.conname}`, () =>
        tx(ctx, () => db.q(`ALTER TABLE votes_old DROP CONSTRAINT IF EXISTS ${fk.conname}`))
      );
    }
    await withRetry(ctx, 'drop votes_old', () => tx(ctx, () => db.q(`DROP TABLE IF EXISTS votes_old`)));
    log('cleanup: votes_old dropped');
  }
  await db.q(`DROP TABLE IF EXISTS votes_compact_log, votes_compact_settle, votes_compact_state`);
  await db.q(`DROP FUNCTION IF EXISTS votes_compact_reverse_mirror(), votes_compact_log_votes(), votes_compact_log_users(), votes_compact_no_truncate()`);
  log('cleanup: done. Consider validate-fk if not run yet.');
}

async function phaseAbort(ctx: Ctx): Promise<void> {
  const { db, opts } = ctx;
  await requireConfirm(ctx, 'abort');
  if (!ctx.dry && (await tableNames(ctx)).swapped) throw new Error('already swapped: use rollback first');
  await withRetry(ctx, 'drop triggers', () =>
    tx(ctx, async () => {
      for (const s of SQL.dropForwardTriggersOn('votes')) await db.q(s);
      await db.q(`DROP TRIGGER IF EXISTS votes_compact_log_users ON users`);
    })
  );
  // votes_compact may hold FKs to users/images: drop them with short locks first.
  if (ctx.dry || (await relExists(ctx, 'votes_compact'))) {
    for (const fk of SQL.fks) {
      await withRetry(ctx, `drop ${fk.name}`, () =>
        tx(ctx, () => db.q(`ALTER TABLE IF EXISTS votes_compact DROP CONSTRAINT IF EXISTS ${fk.name}`))
      );
    }
  }
  await db.q(`DROP TABLE IF EXISTS votes_compact, votes_compact_log, votes_compact_settle, votes_compact_state`);
  await db.q(`DROP FUNCTION IF EXISTS votes_compact_reverse_mirror(), votes_compact_log_votes(), votes_compact_log_users(), votes_compact_no_truncate()`);
  if (opts.dropNumId) {
    await withRetry(ctx, 'drop users.num_id', () =>
      tx(ctx, async () => {
        await db.q(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_num_id_key`);
        await db.q(`ALTER TABLE users DROP COLUMN IF EXISTS num_id`);
      })
    );
    await db.q(`DROP SEQUENCE IF EXISTS users_num_id_seq`);
  }
  log(`abort: migration objects removed${opts.dropNumId ? ' (including users.num_id)' : '; users.num_id kept (harmless; --drop-num-id removes it)'}`);
}

// ── Entry point ─────────────────────────────────────────────────────────────

const ADVISORY_KEY = 7241964200;

export async function run(argv: string[]): Promise<number> {
  const opts = parseArgs(argv);
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  let db: Db;
  let client: pg.Client | null = null;
  if (opts.dryRun) {
    console.log(`-- migrate-votes-compact ${opts.phase} --dry-run: SQL in execution order (one loop iteration shown; nothing is executed)\n`);
    db = new DryRunDb();
  } else {
    if (!url) throw new Error('Set POSTGRES_URL (or DATABASE_URL)');
    client = new pg.Client({ connectionString: url, application_name: 'migrate-votes-compact' });
    await client.connect();
    db = new PgDb(client);
    log(`connected to ${describeUrl(url)}; phase ${opts.phase}`);
    await db.q(`SET statement_timeout = '${opts.statementTimeoutMs}ms'`);
    await db.q(`SET lock_timeout = '${opts.lockTimeoutMs}ms'`);
    // A hung script must never sit on locks inside an open transaction.
    await db.q(`SET idle_in_transaction_session_timeout = '60s'`);
    // One core at most: no parallel scans fanning out on a busy host.
    await db.q(`SET max_parallel_workers_per_gather = 0`);
    await db.q(`SET jit = off`);
    // If this process dies mid-statement (e.g. during an index build), the
    // server notices within 10 s and cancels instead of running on alone.
    await db.q(`SET client_connection_check_interval = '10s'`).catch(() => {});
    if (opts.phase !== 'status') {
      const lock = await db.q<{ ok: boolean }>(`SELECT pg_try_advisory_lock(${ADVISORY_KEY}) AS ok`);
      if (!lock.rows[0].ok) throw new Error('another migrate-votes-compact run holds the lock');
    }
  }
  const ctx: Ctx = { db, opts, dry: opts.dryRun, stopping: false };
  const onSignal = (sig: string) => {
    if (ctx.stopping) {
      log(`${sig} again: exiting now (the open transaction rolls back; progress up to the last batch is kept)`);
      process.exit(130);
    }
    ctx.stopping = true;
    log(`${sig}: finishing the current step, then stopping (Ctrl-C again to quit immediately)`);
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  let code = 0;
  try {
    switch (opts.phase) {
      case 'status': await phaseStatus(ctx); break;
      case 'prepare': await phasePrepare(ctx); break;
      case 'backfill': await phaseBackfill(ctx); break;
      case 'index': await phaseIndex(ctx); break;
      case 'catchup': await phaseCatchup(ctx); break;
      case 'verify': code = (await phaseVerify(ctx)).ok ? 0 : 1; break;
      case 'swap': await phaseSwap(ctx); break;
      case 'rollback': await phaseRollback(ctx); break;
      case 'validate-fk': await phaseValidateFk(ctx); break;
      case 'cleanup': await phaseCleanup(ctx); break;
      case 'abort': await phaseAbort(ctx); break;
    }
  } finally {
    await db.end().catch(() => {});
  }
  if (opts.dryRun) console.log('-- dry run: nothing was executed (log lines above assume an empty, fresh state)');
  return code;
}

function isMain(): boolean {
  try {
    const entry = process.argv[1];
    return !!entry && fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`migrate-votes-compact: ${err instanceof Error ? err.message : String(err)}`);
      if (process.env.DEBUG) console.error(err);
      process.exit(1);
    }
  );
}

export { oneLine, SQL };
