// Votes table layout, shared by the app (lib/votes.ts, lib/db.ts) and tests.
//
// Two layouts exist while the compaction (scripts/migrate-votes-compact.ts,
// docs/votes-compaction.md) is rolled out:
//
//   legacy:  votes(id serial PK, user_id text, image_id int, type text,
//                  created_at timestamptz, UNIQUE (user_id, image_id))
//   compact: votes(user_num int, image_id int, is_up boolean,
//                  created_at timestamptz, PRIMARY KEY (user_num, image_id))
//            where user_num = users.num_id
//
// The app detects the active layout at runtime, so the same build works
// before, during and after the swap. Nothing in this file touches the
// database: it only holds SQL text and pure helpers.

export type VotesSchema = 'legacy' | 'compact';
export type VoteType = 'upvote' | 'downvote';

/** True when `votes` has the compact layout (a user_num column). */
export const DETECT_VOTES_SCHEMA_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = to_regclass('votes')
      AND attname = 'user_num'
      AND NOT attisdropped
  ) AS compact`;

export function schemaFromDetectRow(row: { compact?: boolean } | undefined): VotesSchema {
  return row?.compact ? 'compact' : 'legacy';
}

export function isVoteType(value: unknown): value is VoteType {
  return value === 'upvote' || value === 'downvote';
}

export function voteTypeToIsUp(type: VoteType): boolean {
  return type === 'upvote';
}

export function isUpToVoteType(isUp: boolean | null | undefined): VoteType | null {
  if (isUp === true) return 'upvote';
  if (isUp === false) return 'downvote';
  return null;
}

/**
 * Errors that mean "the votes table has the other layout": undefined_column
 * (42703) or undefined_table (42P01). Seen once per process right after the
 * swap (or a rollback); the caller re-detects and retries.
 */
export function isVotesSchemaMismatch(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === '42703' || code === '42P01';
}

/**
 * Every statement the app runs against `votes`, per layout. The legacy
 * statements address a vote by its (user_id, image_id) unique key rather than
 * the surrogate id so a request that straddles the swap still targets the
 * same vote. `DELETE FROM votes WHERE image_id = $1` (image hard delete) is
 * valid in both layouts and is not listed.
 */
export const VOTE_SQL = {
  legacy: {
    // $1 user id (text), $2 image id
    get: `SELECT type FROM votes WHERE user_id = $1 AND image_id = $2`,
    remove: `DELETE FROM votes WHERE user_id = $1 AND image_id = $2`,
    // $3 'upvote' | 'downvote'
    change: `UPDATE votes SET type = $3, created_at = NOW() WHERE user_id = $1 AND image_id = $2`,
    add: `INSERT INTO votes (user_id, image_id, type, created_at) VALUES ($1, $2, $3, NOW())`,
    // $1 user id, $2 limit
    likes: `SELECT i.*
         FROM votes v
         JOIN images i ON i.id = v.image_id
         WHERE v.user_id = $1 AND v.type = 'upvote'
         ORDER BY v.created_at DESC
         LIMIT $2`,
  },
  compact: {
    // $1 user_num, $2 image id
    get: `SELECT is_up FROM votes WHERE user_num = $1 AND image_id = $2`,
    remove: `DELETE FROM votes WHERE user_num = $1 AND image_id = $2`,
    // $3 is_up
    change: `UPDATE votes SET is_up = $3, created_at = NOW() WHERE user_num = $1 AND image_id = $2`,
    add: `INSERT INTO votes (user_num, image_id, is_up, created_at) VALUES ($1, $2, $3, NOW())`,
    // $1 user_num, $2 limit. `v.is_up` must stay a bare boolean so the
    // planner matches the partial index (… WHERE is_up).
    likes: `SELECT i.*
         FROM votes v
         JOIN images i ON i.id = v.image_id
         WHERE v.user_num = $1 AND v.is_up
         ORDER BY v.created_at DESC
         LIMIT $2`,
  },
} as const;

/** `$3` parameter for change/add in the given layout. */
export function voteParam(schema: VotesSchema, type: VoteType): string | boolean {
  return schema === 'compact' ? voteTypeToIsUp(type) : type;
}

/** Reads the vote type out of a `get` row in the given layout. */
export function voteFromRow(
  schema: VotesSchema,
  row: { type?: unknown; is_up?: unknown } | undefined
): VoteType | null {
  if (!row) return null;
  if (schema === 'compact') {
    return isUpToVoteType(typeof row.is_up === 'boolean' ? row.is_up : null);
  }
  return isVoteType(row.type) ? row.type : null;
}

/**
 * What a vote request does, given the user's current vote. Mirrors the
 * original /api/vote behaviour: voting the same way again (or sending '')
 * removes the vote, voting the other way changes it.
 */
export type VoteAction = 'remove' | 'change' | 'add' | 'none';

export function planVote(current: VoteType | null, requested: VoteType | ''): VoteAction {
  if (requested === '' || current === requested) {
    return current ? 'remove' : 'none';
  }
  return current ? 'change' : 'add';
}

/** Secondary indexes the boot-time ensureIndexes() keeps on `votes`. */
export const VOTES_INDEXES: Record<VotesSchema, { name: string; sql: string }[]> = {
  legacy: [
    { name: 'idx_votes_user', sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_user ON votes (user_id, created_at DESC)` },
    { name: 'idx_votes_image', sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_image ON votes (image_id)` },
  ],
  // Same definitions and names the migration script builds on votes_compact;
  // after the swap they are no-ops. Only listed in compact mode so a boot
  // during the migration never builds them on the legacy table or drops an
  // in-progress build as "invalid".
  compact: [
    { name: 'idx_votes_compact_image', sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_compact_image ON votes (image_id)` },
    { name: 'idx_votes_compact_user_up', sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_compact_user_up ON votes (user_num, created_at DESC) WHERE is_up` },
  ],
};
