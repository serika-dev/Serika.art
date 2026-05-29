import { query } from '../lib/db';

async function test() {
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
    `);
    console.log('users table created successfully!');

    await query(`
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
    `);
    console.log('tags table created successfully!');

    await query(`
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
    `);
    console.log('images table created successfully!');

    await query(`
      -- Image-Tag junction
      CREATE TABLE IF NOT EXISTS image_tags (
        image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (image_id, tag_id)
      );
      CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags (tag_id);
      CREATE INDEX IF NOT EXISTS idx_image_tags_image ON image_tags (image_id);
    `);
    console.log('image_tags table created successfully!');

    await query(`
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
    `);
    console.log('votes table created successfully!');

    await query(`
      -- Favorites
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, image_id)
      );
      CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id, created_at DESC);
    `);
    console.log('favorites table created successfully!');

    await query(`
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
    `);
    console.log('comments table created successfully!');

    await query(`
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
    `);
    console.log('artists table created successfully!');

    await query(`
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
    `);
    console.log('artist_claims table created successfully!');

    await query(`
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
    `);
    console.log('artist_reviews table created successfully!');

    await query(`
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
    `);
    console.log('artist_wikis table created successfully!');

    await query(`
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
    `);
    console.log('api_keys table created successfully!');

    await query(`
      -- Counters
      CREATE TABLE IF NOT EXISTS counters (
        name TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      );
    `);
    console.log('counters table created successfully!');

    await query(`
      -- Import Jobs
      CREATE TABLE IF NOT EXISTS import_jobs (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        query TEXT NOT NULL,
        "limit" INTEGER NOT NULL DEFAULT 100,
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
    `);
    console.log('import_jobs table created successfully!');

    await query(`
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('dmca_requests table created successfully!');

  } catch (err) {
    console.error('Failure creating tables:', err);
  }
  process.exit(0);
}
test();
