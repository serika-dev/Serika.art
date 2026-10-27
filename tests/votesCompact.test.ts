// Pure helpers of the votes compaction (no database).
// Run: bun --no-env-file test tests   (or: node --experimental-strip-types --test tests/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VOTE_SQL,
  VOTES_INDEXES,
  isUpToVoteType,
  isVotesSchemaMismatch,
  planVote,
  schemaFromDetectRow,
  voteFromRow,
  voteParam,
  voteTypeToIsUp,
} from '../lib/votesSchema';
import {
  adjustBatchTarget,
  computeSleepMs,
  describeUrl,
  formatDuration,
  nextWindow,
  parseArgs,
  parseUntil,
  sameVote,
  tidAt,
} from '../scripts/migrate-votes-compact';

test('vote type <-> is_up', () => {
  assert.equal(voteTypeToIsUp('upvote'), true);
  assert.equal(voteTypeToIsUp('downvote'), false);
  assert.equal(isUpToVoteType(true), 'upvote');
  assert.equal(isUpToVoteType(false), 'downvote');
  assert.equal(isUpToVoteType(null), null);
  assert.equal(isUpToVoteType(undefined), null);
});

test('voteFromRow reads both layouts and keeps API strings', () => {
  assert.equal(voteFromRow('legacy', { type: 'upvote' }), 'upvote');
  assert.equal(voteFromRow('legacy', { type: 'downvote' }), 'downvote');
  assert.equal(voteFromRow('legacy', { type: 'bogus' }), null);
  assert.equal(voteFromRow('compact', { is_up: true }), 'upvote');
  assert.equal(voteFromRow('compact', { is_up: false }), 'downvote');
  assert.equal(voteFromRow('compact', undefined), null);
  assert.equal(voteParam('compact', 'downvote'), false);
  assert.equal(voteParam('legacy', 'downvote'), 'downvote');
});

test('planVote matches the original /api/vote semantics', () => {
  assert.equal(planVote(null, 'upvote'), 'add');
  assert.equal(planVote('upvote', 'upvote'), 'remove');
  assert.equal(planVote('upvote', 'downvote'), 'change');
  assert.equal(planVote('downvote', ''), 'remove');
  assert.equal(planVote(null, ''), 'none');
});

test('layout detection and mismatch errors', () => {
  assert.equal(schemaFromDetectRow({ compact: true }), 'compact');
  assert.equal(schemaFromDetectRow({ compact: false }), 'legacy');
  assert.equal(schemaFromDetectRow(undefined), 'legacy');
  assert.equal(isVotesSchemaMismatch({ code: '42703' }), true);
  assert.equal(isVotesSchemaMismatch({ code: '42P01' }), true);
  assert.equal(isVotesSchemaMismatch({ code: '23505' }), false);
  assert.equal(isVotesSchemaMismatch(null), false);
});

test('compact SQL never references legacy columns and vice versa', () => {
  for (const sql of Object.values(VOTE_SQL.compact)) {
    assert.doesNotMatch(sql, /\buser_id\b|\btype\b/);
  }
  for (const sql of Object.values(VOTE_SQL.legacy)) {
    assert.doesNotMatch(sql, /user_num|is_up/);
  }
  // The partial-index predicate must stay a bare boolean.
  assert.match(VOTE_SQL.compact.likes, /AND v\.is_up\s/);
  assert.deepEqual(VOTES_INDEXES.legacy.map((i) => i.name), ['idx_votes_user', 'idx_votes_image']);
  for (const i of VOTES_INDEXES.compact) assert.match(i.sql, /CONCURRENTLY IF NOT EXISTS/);
});

test('parseArgs', () => {
  const o = parseArgs(['backfill', '--batch-size', '30000', '--max-rows-per-sec=5000', '--until', '06:30', '--dry-run']);
  assert.equal(o.phase, 'backfill');
  assert.equal(o.batchSize, 30000);
  assert.equal(o.maxRowsPerSec, 5000);
  assert.equal(o.until, '06:30');
  assert.equal(o.dryRun, true);
  assert.equal(parseArgs(['swap', '--no-reverse-mirror']).reverseMirror, false);
  assert.throws(() => parseArgs([]), /Missing phase/);
  assert.throws(() => parseArgs(['backfil']), /Unknown phase/);
  assert.throws(() => parseArgs(['backfill', '--nope']), /Unknown flag/);
  assert.throws(() => parseArgs(['backfill', '--batch-size', 'x']), /not a number/);
  assert.throws(() => parseArgs(['backfill', '--until', '25:00']), /HH:MM/);
  assert.throws(() => parseArgs(['index', '--maintenance-work-mem', 'lots']), /512MB/);
});

test('parseUntil picks the next occurrence', () => {
  const now = new Date(2026, 9, 27, 23, 10, 0);
  const a = parseUntil('06:30', now);
  assert.equal(a.getDate(), 28);
  assert.equal(a.getHours(), 6);
  assert.equal(a.getMinutes(), 30);
  const b = parseUntil('23:45', now);
  assert.equal(b.getDate(), 27);
  assert.equal(b.getHours(), 23);
  const c = parseUntil('23:10', now); // exactly now -> tomorrow
  assert.equal(c.getDate(), 28);
});

test('computeSleepMs enforces the rate cap and the minimum pause', () => {
  // 20k rows at 4k/s needs 5 s; the batch took 1 s -> sleep 4 s
  assert.equal(computeSleepMs(20_000, 1_000, 4_000, 250), 4_000);
  // already slower than the cap -> minimum pause only
  assert.equal(computeSleepMs(20_000, 9_000, 4_000, 250), 250);
  assert.equal(computeSleepMs(0, 10, 4_000, 250), 250);
});

test('adjustBatchTarget backs off on slow batches and recovers', () => {
  assert.equal(adjustBatchTarget(20_000, 5_000, 4_000, 20_000), 10_000);
  assert.equal(adjustBatchTarget(1_000, 9_000, 4_000, 20_000), 1_000); // floor
  assert.equal(adjustBatchTarget(10_000, 500, 4_000, 20_000), 12_500);
  assert.equal(adjustBatchTarget(19_000, 500, 4_000, 20_000), 20_000); // capped
  assert.equal(adjustBatchTarget(20_000, 2_000, 4_000, 20_000), 20_000); // steady
});

test('nextWindow adapts to id gaps without wild swings', () => {
  assert.equal(nextWindow(20_000, 20_000, 20_000, 1_000_000), 20_000);
  assert.equal(nextWindow(20_000, 10_000, 20_000, 1_000_000), 40_000); // sparse ids
  assert.equal(nextWindow(20_000, 0, 20_000, 1_000_000), 80_000); // empty window: grow 4x
  assert.equal(nextWindow(20_000, 1, 20_000, 1_000_000), 80_000); // capped at 4x
  assert.equal(nextWindow(20_000, 80_000, 20_000, 1_000_000), 5_000); // dense: shrink, max 4x
  assert.equal(nextWindow(900_000, 0, 20_000, 1_000_000), 1_000_000); // max window
  assert.ok(nextWindow(1, 0, 20_000, 1_000_000) >= 1);
});

test('misc formatting', () => {
  assert.equal(describeUrl('postgres://u:secret@db.example:5432/serika'), 'db.example:5432/serika');
  assert.doesNotMatch(describeUrl('postgres://u:secret@h/db'), /secret/);
  assert.equal(tidAt(123), '(123,0)');
  assert.equal(formatDuration(3_725_000), '1h02m');
  assert.equal(formatDuration(65_000), '1m05s');
  assert.equal(sameVote({ is_up: true, created_at: 'a' }, { is_up: true, created_at: 'a' }), true);
  assert.equal(sameVote({ is_up: true, created_at: 'a' }, undefined), false);
});
