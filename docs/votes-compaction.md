# Votes table compaction runbook

`votes` is 244.5M rows / 71 GB (heap 19 GB, indexes 51 GB) for what is
essentially "user X up- or down-voted image Y at time T". This migration
rewrites it online, without downtime, into a layout of about **26 GB
(-63%)**:

| | legacy `votes` | compact `votes` |
|---|---|---|
| columns | `id serial`, `user_id text` (24-char ObjectId), `image_id int`, `type text`, `created_at` | `user_num int` (= `users.num_id`), `image_id int`, `is_up bool`, `created_at` |
| keys | `votes_pkey (id)` 5.2 GB, `UNIQUE (user_id, image_id)` 20 GB | `PRIMARY KEY (user_num, image_id)` ~5.1 GB |
| indexes | `idx_votes_user (user_id, created_at DESC)` 24 GB, `idx_votes_image` 2.7 GB | `idx_votes_compact_user_up (user_num, created_at DESC) WHERE is_up` ~6.8 GB, `idx_votes_compact_image` ~2.1 GB |
| heap | 19 GB (~80 B/row) | ~12 GB (52.5 B/row) |

Nothing needs the surrogate `id`: the vote route now addresses a vote by
(user, image). The only index that reads `created_at` is the profile "likes"
list, which only wants upvotes, so that index is partial.

Tools:

* `scripts/migrate-votes-compact.ts`: the migration, one phase per run,
  every phase idempotent and resumable. `--dry-run` prints the SQL without
  connecting.
* `scripts/votes-compact-e2e.ts`: full rehearsal against a local throwaway
  Postgres (refuses anything that is not `localhost` and `*test*`).
* `lib/votes.ts` + `lib/votesSchema.ts`: the app code. It detects the layout
  at runtime, so **the same deploy works before, during and after the swap**
  (and after a rollback).

## How nothing gets lost

1. `prepare` installs statement-level triggers on `votes` that append the
   `(user_id, image_id)` of every inserted, updated or deleted vote to
   `votes_compact_log` (including `ON DELETE CASCADE` deletes from users and
   images), plus a trigger on `users` that logs deleted users. `TRUNCATE votes`
   is blocked while the migration runs.
2. `backfill` copies every row with `id <=` a high-water mark taken after the
   triggers exist. It does not care about concurrent changes.
3. A key that is not in the log has not changed since `prepare`, so its copy
   is exact. Every logged key is rewritten from the live `votes` row
   (delete all copies, insert the current row): first in bulk (`index` phase
   "settle"), then continuously (`catchup`).
4. `swap` locks `votes`, applies the last log rows with no writer able to
   interfere, and renames, all in one transaction. At that instant the two
   tables are identical.
5. After the swap a row trigger mirrors every change of the new `votes` back
   into `votes_old`, so `rollback` is instant and loses nothing until
   `cleanup`.

Why not mirror straight into `votes_compact` during the backfill (the
original plan)? It needs the unique index to exist during the backfill:
244M random inserts into three B-trees cost several times the I/O and WAL of
the copy itself (every leaf page dirtied and full-page-logged again and
again), which is exactly what the server cannot take. It also races the
backfill: a vote deleted between the backfill's snapshot and its insert
comes back to life unless the backfill row-locks the source, and locking
rewrites the whole 19 GB heap. With the log there is nothing to race: the
backfill writes an index-less heap sequentially, indexes are built once,
sorted and compact, and correctness rests on "logged keys get re-read".

## Before the night

1. **Deploy the app code from this branch first** (days before is fine). On
   the legacy layout it runs the same queries as before (votes addressed by
   `(user_id, image_id)` instead of `id`) and returns identical JSON. After
   the swap it switches by itself: the first statement that hits the other
   layout fails with "column does not exist", the helper re-detects and
   retries once. Boot (`ensureIndexes`) only builds the indexes of the live
   layout, so it never builds the 24 GB `idx_votes_user` on the new table.
2. **Disk**: the new table needs ~26 GB, index builds need up to ~7 GB of
   temporary sort files (`pgsql_tmp`), plus WAL headroom. Have **at least
   40 GB free** on the Postgres volume. The 71 GB come back at `cleanup`.
3. **WAL**: about 21-23 GB of WAL during the backfill and 19-35 GB during the
   index phase (vacuum freeze + index builds; depends on checkpoint timing),
   spread over hours. With no
   archiving or replication slots it is recycled at checkpoints. If there is
   archiving or a replica, make sure it keeps up:
   `SELECT * FROM pg_stat_archiver; SELECT * FROM pg_replication_slots;`
4. **Backup**: have a recent one.
5. **Dry-run** each phase you are about to run and read the SQL:
   `bun scripts/migrate-votes-compact.ts prepare --dry-run`.

### Where and how to run it

Run it **inside the serika.art container** (it has the repo, `bun`, and
`POSTGRES_URL`), in `tmux`/`screen` or with `nohup ... &`, so a dropped SSH
session does not stop it. There `--max-load` reads the host's load average
(load is not namespaced). Do not push to `main` while a phase runs: the
redeploy replaces the container and kills the script. That is safe (it
resumes), just annoying. For a long backfill, a one-off container on the same
network with the repo mounted avoids that.

```sh
# in the container
cd /app
bun scripts/migrate-votes-compact.ts status
# or, with Node >= 22.6: node --experimental-strip-types scripts/migrate-votes-compact.ts status
```

> On a dev machine never run it with plain `bun` from the repo: Bun loads
> `.env.local`, which points at production. Use `bun --no-env-file` and an
> explicit local `POSTGRES_URL`.

Every phase that changes something the app reads (`prepare`, `swap`,
`rollback`, `cleanup`, `abort`) needs `--confirm <database name>`.

## Phases, commands and expected durations

Durations are extrapolated from the local rehearsal (3M rows, Postgres 18,
NVMe; 244.5M is 81.5x that) and padded for a busy host. The throttle, not
the database, sets the backfill time.

| # | Phase | Command | Duration at 244.5M rows | Locks / load |
|---|---|---|---|---|
| 1 | prepare | `... prepare --confirm <db>` | seconds | brief ACCESS EXCLUSIVE on `users` (add column), SHARE ROW EXCLUSIVE on `votes`/`users` (triggers); each with `lock_timeout 3s`, retried |
| 2 | backfill | `... backfill --max-rows-per-sec 8000 --until 07:00` | 5k rows/s: 13.6 h; 8k: 8.5 h; 10k: 6.8 h; 15k: 4.5 h | none on `votes` beyond reads; ~0.5 MB/s heap writes per 8k rows/s |
| 3 | index | `... index --until 07:00` | settle 10-30 min, vacuum 15-40 min, 3 index builds 15-30 min each (local: 4, 3, 4 min unloaded) | the builds cannot be throttled; one CPU core each; no locks on `votes` |
| - | catchup | `... catchup --follow` | keeps up with live writes | small transactions |
| 4 | verify | `... verify` | 1-5 min | reads samples. `--full` reads everything: ~3.5 h at `--max-rows-per-sec 20000`, optional |
| 5 | swap | `... swap --confirm <db>` | the locked part took 30-63 ms at 3M rows (up to 269 ms in a small run on a USB disk); requests queue at most `lock_timeout` (3 s) per attempt | ACCESS EXCLUSIVE on `votes` for that transaction |
| 6 | cleanup | `... cleanup --confirm <db>` (>= 3 days later) | seconds | short locks to drop FKs, then `DROP TABLE votes_old` (frees 71 GB) |
| - | validate-fk | `... validate-fk` | ~20-40 min (one scan) | optional, does not block writes |

A realistic plan:

* **Night 1**: `prepare`, then `backfill --max-rows-per-sec 8000 --until 07:00`.
  Re-run the same backfill command the next night(s) until it reports
  complete. Raise or lower the rate while watching the host
  (`--max-rows-per-sec 15000` is still only a few MB/s of I/O).
* **Night 2 (or 3)**: `index --until 07:00` (re-run to continue), then leave
  `catchup --follow` running.
* **Swap night**: `verify`, then `swap --confirm <db>`. Watch the app for a
  few minutes (`/api/vote`, a profile's likes tab, an image page).
* **3+ days later**: `cleanup --confirm <db>`, optionally `validate-fk`.

### Throttle flags (backfill, settle, catchup, verify --full)

| flag | default | meaning |
|---|---|---|
| `--batch-size` | 20000 | target rows per transaction |
| `--max-rows-per-sec` | 5000 | hard cap on the average copy rate |
| `--sleep-ms` | 250 | minimum pause between batches |
| `--max-batch-ms` | 4000 | a batch slower than this halves the batch size (the database is struggling); it grows back when fast |
| `--max-load` | 1.2 | wait while the 1-minute load average is above 1.2 x CPUs (same rule as the sample worker); `0` disables |
| `--until HH:MM` | - | stop cleanly at that local time (next occurrence) |
| `--pause-file` | `/tmp/votes-compact.pause` | wait while this file exists |

Each batch runs with `statement_timeout 60s` and `lock_timeout 3s`; the
session has `idle_in_transaction_session_timeout 60s`, no parallel workers,
no JIT, and `client_connection_check_interval 10s` (a killed script's running
statement is cancelled by the server).

## Monitoring

```sh
bun scripts/migrate-votes-compact.ts status     # progress, sizes, pending log rows, index build progress
```

```sql
-- what the script is doing
SELECT pid, state, now() - query_start AS running, wait_event_type, wait_event, left(query, 80)
FROM pg_stat_activity WHERE application_name = 'migrate-votes-compact';
-- index build / vacuum progress
SELECT * FROM pg_stat_progress_create_index;
SELECT * FROM pg_stat_progress_vacuum;
-- anyone waiting on a lock (should be empty or transient)
SELECT pid, mode, relation::regclass, granted FROM pg_locks WHERE NOT granted;
-- change log backlog
SELECT count(*) FROM votes_compact_log;
```

On the host: load (`uptime`), disk (`iostat -x 5`, `df -h`). The script logs
a progress line every 30 s with rows/s and an ETA.

## Pause, resume, abort

* **Pause**: `touch /tmp/votes-compact.pause` (loops wait; `rm` to continue),
  or Ctrl-C / `kill -TERM <pid>`: it finishes the current batch and exits.
  A second Ctrl-C exits immediately; the open transaction rolls back and the
  checkpoint (committed with each batch) stays consistent.
* **Resume**: run the same command again. Every phase picks up from its
  state in `votes_compact_state`.
* **Stop an index build**: Ctrl-C twice (the server cancels it within 10 s),
  or `SELECT pg_cancel_backend(pid)` for the script's pid. The cancelled
  build leaves an INVALID index; re-running `index` drops and rebuilds it.
* **Abort the whole migration (before the swap)**:
  `abort --confirm <db>` drops the triggers, `votes_compact`, the log and the
  state tables. `users.num_id` stays (harmless, the app ignores it on the
  legacy layout); add `--drop-num-id` to remove it too. Nothing in the live
  `votes` table was ever changed.

## Rollback

* **Before the swap**: `abort` (above). The app was never affected.
* **After the swap, before cleanup**: `rollback --confirm <db>`. One short
  transaction renames the tables back and reinstalls the change-log
  triggers; `votes_old` was kept identical by the reverse-mirror trigger, so
  no vote is lost. The app switches back on its own. `votes_compact` keeps
  being caught up from the log, so you can `verify` and `swap` again later.
  (If the swap was run with `--no-reverse-mirror`, rollback refuses unless
  `--force`, because votes cast after the swap would be lost.)
* **After cleanup**: no rollback; restore from backup.

## Risks and how they are handled

| risk | handling |
|---|---|
| heavy I/O crashes the host | rate cap, adaptive batch size, load gate, `--until`, no parallel workers; no indexes during the copy (sequential heap writes only); vacuum is cost-throttled; settle reads the heap in 32 MB TID-range chunks at <= 50% duty |
| a bulk statement picks a full scan of a 12-19 GB table | every per-key lookup is `LATERAL (... LIMIT 1)` (cannot become a hash join); settle and catchup work in chunks of 5000 keys; plans checked with EXPLAIN in the rehearsal |
| index builds cannot be throttled | run them at night, one at a time, single core, 512 MB `maintenance_work_mem`; `--until` is checked between builds |
| lock queues stall the site | every DDL and the swap use `lock_timeout 3s` and retry with backoff; nothing holds a lock on `votes` longer than the swap transaction (30-63 ms in rehearsals) |
| a vote changes during the copy | change log + settle/catchup; the final drain happens under the swap lock. Rehearsed with 8 concurrent writers (~118k votes cast, plus image and user deletions) through every phase including swap, rollback and a second swap: 0 lost, 0 duplicated, 0 stale, 0 writer errors |
| app breaks at swap time | runtime layout detection with retry on "column does not exist"; rehearsed with writers running through swap and rollback |
| boot rebuilds the old 24 GB index on the new table | `ensureIndexes` only lists the indexes of the live layout; `syncSequencesAndCounters` skips `votes_id_seq` on the compact layout |
| unexpected `votes.type` values | `prepare` checks the statistics; the copy maps anything else to NULL, which fails the batch loudly instead of guessing |
| script dies mid-way / container redeploy | every phase is resumable from `votes_compact_state`; batch and checkpoint commit together |
| two copies of the script at once | advisory lock; the backfill also row-locks its checkpoint |
| deadlock between catchup and a user/image delete (both touch the same compact rows) | seen in rehearsal before the fix: catchup now takes the parent rows' KEY SHARE locks (what its FK checks take anyway) first, in key order, so the delete waits for it or finished before; re-rehearsed with deletes running: 0 deadlocks. Left: a user/image delete that coincides with the swap's lock can still deadlock with it (one of them is cancelled; the swap retries) |
| new foreign keys are `NOT VALID` | they are enforced for new rows and cascades work immediately; `validate-fk` proves the old rows later without blocking writes |

## What the owner does on the night (checklist)

1. App from this branch already deployed and healthy.
2. `df -h` on the Postgres volume: >= 40 GB free.
3. In the container, in tmux:
   `bun scripts/migrate-votes-compact.ts prepare --confirm <db>`
4. `bun scripts/migrate-votes-compact.ts backfill --max-rows-per-sec 8000 --until 07:00`
   (watch load; Ctrl-C and re-run with another rate if needed).
5. Next night(s): re-run backfill until "complete", then
   `bun scripts/migrate-votes-compact.ts index --until 07:00` (re-run until
   "index phase done"), then `bun scripts/migrate-votes-compact.ts catchup --follow`.
6. Swap night: stop the `catchup --follow`, run
   `bun scripts/migrate-votes-compact.ts verify` (must print `verify: OK`),
   then `bun scripts/migrate-votes-compact.ts swap --confirm <db>`.
7. Check voting, an image page and a profile's likes. If anything is wrong:
   `rollback --confirm <db>`.
8. After 3+ quiet days: `cleanup --confirm <db>` (frees ~71 GB), then
   optionally `validate-fk`.

## Rehearsing locally

```sh
podman run -d --name votes-pg -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=serika_test -p 127.0.0.1:55432:5432 docker.io/library/postgres:18
POSTGRES_URL=postgres://postgres@127.0.0.1:55432/serika_test \
  bun --no-env-file scripts/votes-compact-e2e.ts --votes 3000000
podman rm -f votes-pg
```

Results of the rehearsal on 3M votes (2,000 users, 300k images):

| | value |
|---|---|
| legacy, freshly built | 286 B/row (production: 312 B/row, it is also bloated) |
| compact | 113.7-114.8 B/row: heap 52.5-53.4, PK 22.2-22.6, `idx_votes_compact_image` 9.1-9.3, `idx_votes_compact_user_up` 29.2-30.7 |
| size reduction | 60% vs freshly built legacy; **~26 GB vs 71 GB in production (-63%)** |
| unthrottled copy rate (local NVMe, warm cache) | ~570-590k rows/s, i.e. the throttle always binds |
| WAL | backfill 92-103 B/row (~21-23 GB at 244.5M), index phase 77-153 B/row (~19-35 GB) |
| index builds (3M rows, unloaded) | PK 3 s, image 2 s, partial user index 3 s; vacuum freeze 1 s |
| swap lock held | 30-63 ms; vote latency during the swap at most ~100 ms |
| correctness | every phase run with 8 concurrent writers (~118k votes cast, 150+ images and 18 users hard-deleted); `votes == votes_old` exactly after swap, rollback and re-swap; all touched keys hold their last written vote; all ~2.96M untouched votes identical to the original; 0 writer errors, 0 deadlocks |
