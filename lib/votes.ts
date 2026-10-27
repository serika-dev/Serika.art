// Vote storage, independent of the votes table layout (see lib/votesSchema.ts).
// Routes call these helpers instead of writing SQL against `votes` so the app
// keeps working across the compaction swap and a possible rollback.

import { query } from '@/lib/db';
import {
  DETECT_VOTES_SCHEMA_SQL,
  VOTE_SQL,
  isVotesSchemaMismatch,
  planVote,
  schemaFromDetectRow,
  voteFromRow,
  voteParam,
  type VoteType,
  type VotesSchema,
} from '@/lib/votesSchema';

export type { VoteType, VotesSchema } from '@/lib/votesSchema';

// Layout cache. A wrong cached value is harmless: every layout-specific
// statement fails with undefined_column on the other layout, which drops the
// cache and retries once (see withVotesSchema). The TTL only bounds how long
// a process keeps a stale answer if it never touches votes.
const SCHEMA_TTL_MS = 5 * 60_000;
let schemaCache: { schema: VotesSchema; at: number } | null = null;
let schemaInflight: Promise<VotesSchema> | null = null;

export async function getVotesSchema(): Promise<VotesSchema> {
  if (schemaCache && Date.now() - schemaCache.at < SCHEMA_TTL_MS) return schemaCache.schema;
  if (!schemaInflight) {
    schemaInflight = query(DETECT_VOTES_SCHEMA_SQL)
      .then((res) => {
        const schema = schemaFromDetectRow(res.rows[0]);
        schemaCache = { schema, at: Date.now() };
        return schema;
      })
      .finally(() => {
        schemaInflight = null;
      });
  }
  return schemaInflight;
}

export function invalidateVotesSchema(): void {
  schemaCache = null;
}

async function withVotesSchema<T>(fn: (schema: VotesSchema) => Promise<T>): Promise<T> {
  const schema = await getVotesSchema();
  try {
    return await fn(schema);
  } catch (err) {
    if (!isVotesSchemaMismatch(err)) throw err;
    // The table was swapped under us. The failed statement did nothing, so
    // retrying with the fresh layout is safe.
    invalidateVotesSchema();
    const fresh = await getVotesSchema();
    if (fresh === schema) throw err;
    return fn(fresh);
  }
}

// users.id -> users.num_id. num_id never changes once assigned, so entries
// only leave the cache to bound memory (~3k users today).
const USER_NUM_CACHE_MAX = 20_000;
const userNumCache = new Map<string, number>();

export async function resolveUserNum(userId: string): Promise<number | null> {
  const hit = userNumCache.get(userId);
  if (hit !== undefined) return hit;
  const res = await query<{ num_id: number | null }>(
    `SELECT num_id FROM users WHERE id = $1`,
    [userId]
  );
  const num = res.rows[0]?.num_id ?? null;
  if (num !== null) {
    if (userNumCache.size >= USER_NUM_CACHE_MAX) {
      userNumCache.delete(userNumCache.keys().next().value as string);
    }
    userNumCache.set(userId, num);
  }
  return num;
}

/** First parameter of a vote statement: users.id (legacy) or users.num_id (compact). */
async function userKey(schema: VotesSchema, userId: string): Promise<string | number | null> {
  return schema === 'compact' ? resolveUserNum(userId) : userId;
}

/** The user's vote on an image (images.id), or null. */
export async function getUserVote(userId: string, imageId: number): Promise<VoteType | null> {
  return withVotesSchema(async (schema) => {
    const key = await userKey(schema, userId);
    if (key === null) return null;
    const res = await query(VOTE_SQL[schema].get, [key, imageId]);
    return voteFromRow(schema, res.rows[0]);
  });
}

/**
 * Applies a vote request ('' clears) and returns the vote before and after.
 * Same semantics as the original /api/vote: repeating the current vote
 * removes it.
 */
export async function castVote(
  userId: string,
  imageId: number,
  requested: VoteType | ''
): Promise<{ previous: VoteType | null; current: VoteType | null }> {
  const previous = await getUserVote(userId, imageId);
  const action = planVote(previous, requested);
  if (action === 'none') return { previous, current: null };

  await withVotesSchema(async (schema) => {
    const key = await userKey(schema, userId);
    if (key === null) throw new Error(`Unknown user ${userId}`);
    const sql = VOTE_SQL[schema];
    try {
      if (action === 'remove') {
        await query(sql.remove, [key, imageId]);
      } else {
        await query(action === 'change' ? sql.change : sql.add, [
          key,
          imageId,
          voteParam(schema, requested as VoteType),
        ]);
      }
    } catch (err) {
      // foreign_key_violation: the cached num_id may belong to a deleted user.
      if ((err as { code?: string } | null)?.code === '23503') userNumCache.delete(userId);
      throw err;
    }
  });

  return { previous, current: action === 'remove' ? null : (requested as VoteType) };
}

/** Image rows (images.*) the user upvoted, newest vote first. */
// Raw images.* rows, passed through to the route exactly as before.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listUpvotedImages(userId: string, limit = 50): Promise<Record<string, any>[]> {
  return withVotesSchema(async (schema) => {
    const key = await userKey(schema, userId);
    if (key === null) return [];
    const res = await query(VOTE_SQL[schema].likes, [key, limit]);
    return res.rows;
  });
}
