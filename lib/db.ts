import { Pool, PoolClient, QueryResult } from 'pg';
import Redis from 'ioredis';

// ── PostgreSQL ──────────────────────────────────────────────────────
const POSTGRES_URL = process.env.POSTGRES_URL!;

if (!POSTGRES_URL) {
  throw new Error('Please define POSTGRES_URL in .env.local');
}

let pool: Pool | null = null;
let schemaInitialized = false;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: POSTGRES_URL,
      max: 50,
      min: 5,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 45000,
    });
    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err);
    });
  }
  return pool;
}

export async function query<T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const p = getPool();
  return p.query<T>(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/** Run a callback inside a transaction – auto commits / rolls back. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Redis ───────────────────────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || '';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!REDIS_URL) return null; // Redis is optional – graceful degradation
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });
    redis.on('error', (err) => {
      console.error('[REDIS] Connection error:', err.message);
    });
    redis.connect().catch(() => {});
  }
  return redis;
}

// ── Cache helpers (Redis-first, in-memory fallback) ─────────────────
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

export async function cacheGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (r) {
    try {
      return await r.get(key);
    } catch {
      // fall through to memory
    }
  }
  const entry = memoryCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.value;
  memoryCache.delete(key);
  return null;
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.set(key, value, 'EX', ttlSeconds);
      return;
    } catch {
      // fall through to memory
    }
  }
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.del(key);
    } catch {
      // ignore
    }
  }
  memoryCache.delete(key);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      const keys = await r.keys(pattern);
      if (keys.length > 0) await r.del(...keys);
    } catch {
      // ignore
    }
  }
  // Memory fallback – iterate
  for (const k of memoryCache.keys()) {
    if (k.startsWith(pattern.replace('*', ''))) memoryCache.delete(k);
  }
}

// ── Cached Counts ───────────────────────────────────────────────────
const COUNT_CACHE_TTL = 300; // 5 minutes

export async function getCachedCount(
  table: string,
  whereClause = '',
  params: any[] = []
): Promise<number> {
  const cacheKey = `count:${table}:${whereClause}:${JSON.stringify(params)}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== null) return parseInt(cached, 10);

  const sql = whereClause
    ? `SELECT COUNT(*) as count FROM ${table} WHERE ${whereClause}`
    : `SELECT COUNT(*) as count FROM ${table}`;

  const result = await query(sql, params);
  const count = parseInt(result.rows[0]?.count ?? '0', 10);
  await cacheSet(cacheKey, String(count), COUNT_CACHE_TTL);
  return count;
}

// ── Sequential ID counter ───────────────────────────────────────────
export async function getNextSequentialId(
  name: string = 'imageSequentialId'
): Promise<number> {
  const result = await query(
    `INSERT INTO counters (name, value)
     VALUES ($1, 1)
     ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
     RETURNING value`,
    [name]
  );
  return result.rows[0].value;
}

/** Synchronize all serial sequences and counters with actual max values in the tables. */
export async function syncSequencesAndCounters(): Promise<void> {
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

  try {
    for (const { table, column, seq } of sequences) {
      await query(`
        SELECT setval($1, COALESCE((SELECT MAX(${column}) FROM ${table}), 1))
      `, [seq]);
    }
    
    await query(`
      INSERT INTO counters (name, value)
      VALUES ('imageSequentialId', COALESCE((SELECT MAX(sequential_id) FROM images), 1))
      ON CONFLICT (name) DO UPDATE SET value = GREATEST(counters.value, EXCLUDED.value)
    `);
    
    console.log('[DB] Sequences and counters synchronized successfully ✓');
  } catch (error) {
    console.error('[DB] Failed to synchronize sequences and counters:', error);
  }
}


// ── Schema bootstrap (called once) ─────────────────────────────────
export async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;
  schemaInitialized = true;

  try {
    await query(`
      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT,
        avatar_url TEXT DEFAULT '',
        rank TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Tags
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'general',
        count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tags_name ON tags (name);
      CREATE INDEX IF NOT EXISTS idx_tags_count ON tags (count DESC, name);

      -- Images
      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        sequential_id INTEGER UNIQUE NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        username TEXT NOT NULL DEFAULT 'Anonymous',
        url TEXT NOT NULL,
        thumbnail_url TEXT,
        original_filename TEXT,
        file_size INTEGER DEFAULT 0,
        width INTEGER DEFAULT 0,
        height INTEGER DEFAULT 0,
        content_type TEXT,
        rating TEXT NOT NULL DEFAULT 'safe',
        is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
        source TEXT DEFAULT '',
        description TEXT DEFAULT '',
        upvotes INTEGER NOT NULL DEFAULT 0,
        downvotes INTEGER NOT NULL DEFAULT 0,
        favorites INTEGER NOT NULL DEFAULT 0,
        views INTEGER NOT NULL DEFAULT 0,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        deleted_at TIMESTAMPTZ,
        deleted_by TEXT,
        deleted_by_username TEXT,
        deletion_reason TEXT,
        deletion_reversible_until TIMESTAMPTZ,
        unlisted BOOLEAN NOT NULL DEFAULT FALSE,
        unlisted_at TIMESTAMPTZ,
        unlisted_by TEXT,
        unlisted_by_username TEXT,
        unlist_reason TEXT,
        unlist_reversible_until TIMESTAMPTZ,
        restored_at TIMESTAMPTZ,
        restored_by TEXT,
        restored_by_username TEXT,
        dmca_request_id INTEGER,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_images_sequential ON images (sequential_id);
      CREATE INDEX IF NOT EXISTS idx_images_user ON images (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_username ON images (LOWER(username), created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_created ON images (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_rating ON images (rating, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_rating_ai ON images (rating, is_ai_generated, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_listing ON images (deleted, unlisted, rating, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_upvotes ON images (upvotes DESC, views DESC);
      CREATE INDEX IF NOT EXISTS idx_images_favorites ON images (favorites DESC);
      CREATE INDEX IF NOT EXISTS idx_images_views ON images (views DESC);

      -- Image-Tag junction
      CREATE TABLE IF NOT EXISTS image_tags (
        image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (image_id, tag_id)
      );
      CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags (tag_id);
      CREATE INDEX IF NOT EXISTS idx_image_tags_image ON image_tags (image_id);

      -- Votes
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, image_id)
      );
      CREATE INDEX IF NOT EXISTS idx_votes_user ON votes (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_votes_image ON votes (image_id);

      -- Favorites
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, image_id)
      );
      CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id, created_at DESC);

      -- Comments
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        avatar_url TEXT,
        rank TEXT DEFAULT 'user',
        content TEXT NOT NULL,
        parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        as_artist BOOLEAN DEFAULT FALSE,
        artist_tag_id INTEGER REFERENCES tags(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_comments_image ON comments (image_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_user ON comments (user_id, created_at DESC);

      -- Artists
      CREATE TABLE IF NOT EXISTS artists (
        id SERIAL PRIMARY KEY,
        tag_id INTEGER NOT NULL UNIQUE REFERENCES tags(id),
        tag_name TEXT NOT NULL,
        claimed_by_user_id TEXT REFERENCES users(id),
        claimed_by_username TEXT,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        avatar_url TEXT,
        banner_url TEXT,
        bio TEXT,
        socials JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_artists_tag ON artists (tag_id);
      CREATE INDEX IF NOT EXISTS idx_artists_claimed ON artists (claimed_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_artists_tagname ON artists (tag_name);

      -- Artist Claims
      CREATE TABLE IF NOT EXISTS artist_claims (
        id SERIAL PRIMARY KEY,
        artist_tag_id INTEGER NOT NULL REFERENCES tags(id),
        artist_tag_name TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        username TEXT NOT NULL,
        user_email TEXT NOT NULL,
        verification_words TEXT[] NOT NULL,
        verification_method TEXT NOT NULL,
        additional_info TEXT,
        proof_file_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT REFERENCES users(id),
        reviewed_by_username TEXT,
        review_notes TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_claims_status ON artist_claims (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_claims_user ON artist_claims (user_id, artist_tag_id);

      -- Artist Reviews
      CREATE TABLE IF NOT EXISTS artist_reviews (
        id SERIAL PRIMARY KEY,
        artist_tag_id INTEGER NOT NULL REFERENCES tags(id),
        artist_tag_name TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        username TEXT NOT NULL,
        ratings JSONB NOT NULL,
        comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (artist_tag_id, user_id)
      );

      -- Artist Wikis
      CREATE TABLE IF NOT EXISTS artist_wikis (
        id SERIAL PRIMARY KEY,
        artist_tag_id INTEGER NOT NULL UNIQUE REFERENCES tags(id),
        artist_tag_name TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        infobox JSONB,
        last_edited_by TEXT REFERENCES users(id),
        last_edited_by_username TEXT,
        edit_history JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- API Keys
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        permissions TEXT[] NOT NULL,
        rate_limit INTEGER NOT NULL DEFAULT 60,
        usage_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash);
      CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id);

      -- Counters
      CREATE TABLE IF NOT EXISTS counters (
        name TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      );

      -- Import Jobs
      CREATE TABLE IF NOT EXISTS import_jobs (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        query TEXT NOT NULL,
        limit_val INTEGER NOT NULL DEFAULT 100,
        status TEXT NOT NULL DEFAULT 'pending',
        progress JSONB DEFAULT '{"current":0,"total":0,"successful":0,"failed":0,"skipped":0}',
        post_ids JSONB,
        current_post_index INTEGER DEFAULT 0,
        error TEXT,
        created_by TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_import_status ON import_jobs (status, created_at);

      -- DMCA Requests
      CREATE TABLE IF NOT EXISTS dmca_requests (
        id SERIAL PRIMARY KEY,
        image_id INTEGER REFERENCES images(id),
        image_sequential_id INTEGER,
        reporter_name TEXT NOT NULL,
        reporter_email TEXT NOT NULL,
        reporter_relationship TEXT,
        description TEXT NOT NULL,
        original_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_by_username TEXT,
        review_notes TEXT,
        reviewed_at TIMESTAMPTZ,
        affected_image_ids JSONB,
        notes JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Moderation Logs
      CREATE TABLE IF NOT EXISTS moderation_logs (
        id SERIAL PRIMARY KEY,
        action TEXT,
        target_type TEXT,
        target_id INTEGER,
        performed_by TEXT,
        performed_by_username TEXT,
        reason TEXT,
        dmca_request_id INTEGER,
        previous_state JSONB,
        reversible BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Self-heal/resync any diverged sequences/counters on startup
    await syncSequencesAndCounters();

    console.log('[DB] Schema ensured ✓');
  } catch (error) {
    console.error('[DB] Error ensuring schema:', error);
    // Don't throw – tables might already exist with slightly different definitions
  }
}

// Initialize on first import
ensureSchema().catch(console.error);
