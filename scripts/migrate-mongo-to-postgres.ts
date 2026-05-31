import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) process.env[key] = valueParts.join('=');
      }
    }
  }
}

loadEnvFile();

const verifiedUsersCache = new Set<string>();

async function ensureUserExists(pgPool: Pool, userId: any, username: string) {
  if (!userId) return;
  const sUserId = userId.toString();
  if (verifiedUsersCache.has(sUserId)) return;

  const idCheck = await pgPool.query('SELECT id FROM users WHERE id = $1', [sUserId]);
  if (idCheck.rows.length === 0) {
    const nameCheck = await pgPool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (nameCheck.rows.length > 0) {
      const uniqueUsername = `${username}_${sUserId.slice(-4)}`;
      await pgPool.query(
        `INSERT INTO users (id, username, rank, created_at) VALUES ($1, $2, 'user', '2000-01-01 00:00:00+00') ON CONFLICT (id) DO NOTHING`,
        [sUserId, uniqueUsername]
      );
    } else {
      await pgPool.query(
        `INSERT INTO users (id, username, rank, created_at) VALUES ($1, $2, 'user', '2000-01-01 00:00:00+00') ON CONFLICT (id) DO NOTHING`,
        [sUserId, username]
      );
    }
  }
  verifiedUsersCache.add(sUserId);
}

const mongoUri = process.env.MONGO_URI;
const mongoDbName = process.env.MONGO_DB || 'serika-art';
const postgresUrl = process.env.POSTGRES_URL;

if (!mongoUri) process.exit(1);
if (!postgresUrl) process.exit(1);

async function migrateCollectionInBatches<T>(
  mdb: any, collectionName: string, batchSize: number, limit: number | null, processBatch: (batch: T[]) => Promise<void>
) {
  const collection = mdb.collection(collectionName);
  const cursor = collection.find({});
  let batch: T[] = [];
  let totalProcessed = 0;
  
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (doc) {
      batch.push(doc);
      if (batch.length >= batchSize) {
        await processBatch(batch);
        totalProcessed += batch.length;
        process.stdout.write(`\r  Done: ${totalProcessed} records from '${collectionName}'...`);
        batch = [];
        if (limit && totalProcessed >= limit) break;
      }
    }
  }
  
  if (batch.length > 0 && (!limit || totalProcessed < limit)) {
    await processBatch(batch);
    totalProcessed += batch.length;
    console.log(`\n  Done: ${totalProcessed} records from '${collectionName}'...`);
  } else if (batch.length > 0) {
    console.log(`\n  Finished with limit for '${collectionName}'.`);
  }
}

async function main() {
  console.log('🚀 Starting SUPERFAST DB Migration: MongoDB ➔ PostgreSQL\n');
  const mongoClient = await MongoClient.connect(mongoUri!);
  const mdb = mongoClient.db(mongoDbName);
  const pgPool = new Pool({ connectionString: postgresUrl, max: 20 });

  const shouldClean = process.argv.includes('--clean');
  const skipVotes = process.argv.includes('--skip-votes');
  const skipFavorites = process.argv.includes('--skip-favorites');
  const repairInteractions = process.argv.includes('--repair-interactions');

  try {
    if (shouldClean) {
      console.log('🗑️  Truncating target tables...');
      await pgPool.query(`TRUNCATE TABLE image_tags, votes, favorites, comments, artist_reviews, artist_claims, artist_wikis, artists, dmca_requests, moderation_logs, images, api_keys, users, counters, import_jobs RESTART IDENTITY CASCADE;`);
      console.log('✅ Tables truncated.\n');
    } else if (repairInteractions) {
      console.log('🗑️  Truncating comments, votes, and favorites tables for correction...');
      await pgPool.query(`TRUNCATE TABLE comments, votes, favorites RESTART IDENTITY CASCADE;`);
      console.log('✅ Comments, votes, and favorites tables truncated.\n');
    }

    const tagNameMap = new Map<string, number>();
    const mongoIdToPgId = new Map<string, number>();
    if (!shouldClean) {
      console.log('🔄 Pre-loading existing tags...');
      const tagRes = await pgPool.query('SELECT id, name FROM tags');
      for (const row of tagRes.rows) tagNameMap.set(row.name, row.id);
      console.log(`✅ Loaded ${tagNameMap.size} tags.\n`);
    }

    // --- PHASE 1: USERS ---
    console.log('👤 Migrating users...');
    const mongoUsers = await mdb.collection('users').find({}).toArray();
    const uniqueUsersMap = new Map<string, any>();
    for (const u of mongoUsers) uniqueUsersMap.set(u.id || u._id.toString(), u);
    const deduplicatedUsers = Array.from(uniqueUsersMap.values());
    
    const takenUsernames = new Set<string>();
    const existingUsersById = new Map<string, string>();
    if (!shouldClean) {
      const existingUsers = await pgPool.query('SELECT id, username FROM users');
      for (const row of existingUsers.rows) {
        takenUsernames.add(row.username.toLowerCase());
        existingUsersById.set(row.id, row.username);
      }
    }

    for (const u of deduplicatedUsers) {
      const id = u.id || u._id.toString();
      if (!shouldClean && existingUsersById.has(id)) {
        u.username = existingUsersById.get(id);
        takenUsernames.add(u.username.toLowerCase());
        continue;
      }
      let baseUsername = u.username || 'user';
      let username = baseUsername;
      let suffix = 1;
      while (takenUsernames.has(username.toLowerCase())) {
        username = `${baseUsername}_${suffix++}`;
      }
      u.username = username;
      takenUsernames.add(username.toLowerCase());
    }

    const userChunkSize = 5000;
    const userPromises = [];
    for (let i = 0; i < deduplicatedUsers.length; i += userChunkSize) {
      const chunk = deduplicatedUsers.slice(i, i + userChunkSize);
      const placeholders: string[] = [];
      const values: any[] = [];
      let idx = 1;
      for (const u of chunk) {
        placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6})`);
        values.push(u.id || u._id.toString(), u.username, u.email || null, u.avatarUrl || u.avatar_url || '', u.rank || 'user', u.createdAt || u.created_at || new Date(), u.updatedAt || u.updated_at || new Date());
        idx += 7;
      }
      if (values.length > 0) {
        userPromises.push(pgPool.query(`INSERT INTO users (id, username, email, avatar_url, rank, created_at, updated_at) VALUES ${placeholders.join(', ')} ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url, rank = EXCLUDED.rank, updated_at = EXCLUDED.updated_at`, values));
      }
    }
    await Promise.all(userPromises);
    console.log(`✅ Migrated ${deduplicatedUsers.length} users.\n`);

    // --- PHASE 2: TAGS ---
    console.log('🏷️  Migrating tags...');
    await migrateCollectionInBatches<any>(mdb, 'tags', 100000, null, async (chunk) => {
      const uniqueTagsMap = new Map<string, any>();
      for (const t of chunk) {
        if (!t.name || !t.name.trim()) continue;
        const name = t.name.trim();
        const existing = uniqueTagsMap.get(name);
        if (!existing || (parseInt(t.count) || 0) > (parseInt(existing.count) || 0)) uniqueTagsMap.set(name, t);
      }
      const deduplicatedTags = Array.from(uniqueTagsMap.values());
      const tagPromises = [];
      for (let i = 0; i < deduplicatedTags.length; i += 10000) {
        const subChunk = deduplicatedTags.slice(i, i + 10000);
        const placeholders: string[] = [];
        const values: any[] = [];
        let idx = 1;
        for (const t of subChunk) {
          placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3})`);
          values.push(t.name.trim(), t.type || 'general', parseInt(t.count) || 0, t.createdAt || t.created_at || new Date());
          idx += 4;
        }
        if (values.length > 0) {
          tagPromises.push(pgPool.query(`INSERT INTO tags (name, type, count, created_at) VALUES ${placeholders.join(', ')} ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type, count = EXCLUDED.count RETURNING id, name`, values));
        }
      }
      const results = await Promise.all(tagPromises);
      for (const res of results) for (const row of res.rows) tagNameMap.set(row.name, row.id);
    });
    console.log(`✅ Synced ${tagNameMap.size} tags.\n`);

    // --- PHASE 3: IMAGES & IMAGE_TAGS ---
    console.log('🖼️  Migrating images and their tags junction...');
    const existingImgRes = await pgPool.query('SELECT id, sequential_id FROM images');
    const existingImgIds = new Map<number, number>();
    for (const row of existingImgRes.rows) existingImgIds.set(row.sequential_id, row.id);
    console.log(`✅ Loaded ${existingImgIds.size} existing image records.\n`);

    await migrateCollectionInBatches<any>(mdb, 'images', 50000, null, async (chunk) => {
      const uniqueChunkMap = new Map<number, any>();
      for (const img of chunk) {
        const seqId = parseInt(img.sequentialId || img.sequential_id);
        if (!isNaN(seqId)) uniqueChunkMap.set(seqId, img);
      }
      const deduplicatedChunk = Array.from(uniqueChunkMap.values());
      const filteredChunk = deduplicatedChunk.filter(img => !existingImgIds.has(parseInt(img.sequentialId || img.sequential_id)));

      const chunkUploaderIds = new Set<string>();
      for (const img of filteredChunk) chunkUploaderIds.add((img.userId || img.user_id || 'system').toString());
      await Promise.all(Array.from(chunkUploaderIds).map(userId => ensureUserExists(pgPool, userId, `user_${userId.slice(-6)}`)));

      const imageSeqIdToPgId = new Map<number, number>();
      const imgPromises = [];

      for (let i = 0; i < filteredChunk.length; i += 2000) {
        const subChunk = filteredChunk.slice(i, i + 2000);
        const placeholders: string[] = [];
        const values: any[] = [];
        let idx = 1;

        for (const img of subChunk) {
          placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, $${idx+12}, $${idx+13}, $${idx+14}, $${idx+15}, $${idx+16}, $${idx+17}, $${idx+18}, $${idx+19}, $${idx+20}, $${idx+21}, $${idx+22}, $${idx+23}, $${idx+24}, $${idx+25}, $${idx+26}, $${idx+27}, $${idx+28}, $${idx+29})`);
          values.push(parseInt(img.sequentialId || img.sequential_id), (img.userId || img.user_id || 'system').toString(), img.username || 'Anonymous', img.url, img.thumbnailUrl || img.thumbnail_url || null, img.originalFilename || img.original_filename || null, parseInt(img.fileSize || img.file_size) || 0, parseInt(img.width) || 0, parseInt(img.height) || 0, img.contentType || img.content_type || 'image/png', img.rating || 'safe', img.isAIGenerated || img.is_ai_generated || false, img.source || '', img.description || '', parseInt(img.upvotes) || 0, parseInt(img.downvotes) || 0, parseInt(img.favorites) || 0, parseInt(img.views) || 0, img.deleted || false, img.deletedAt || img.deleted_at || null, img.deletedBy || img.deleted_by || null, img.deletedByUsername || img.deleted_by_username || null, img.deletionReason || img.deletion_reason || null, img.unlisted || false, img.unlistedAt || img.unlisted_at || null, img.unlistedBy || img.unlisted_by || null, img.unlistedByUsername || img.unlisted_by_username || null, img.unlistReason || img.unlist_reason || null, img.createdAt || img.created_at || new Date(), img.updatedAt || img.updated_at || new Date());
          idx += 30;
        }
        if (values.length > 0) {
          imgPromises.push(pgPool.query(`INSERT INTO images (sequential_id, user_id, username, url, thumbnail_url, original_filename, file_size, width, height, content_type, rating, is_ai_generated, source, description, upvotes, downvotes, favorites, views, deleted, deleted_at, deleted_by, deleted_by_username, deletion_reason, unlisted, unlisted_at, unlisted_by, unlisted_by_username, unlist_reason, created_at, updated_at) VALUES ${placeholders.join(', ')} ON CONFLICT (sequential_id) DO UPDATE SET url = EXCLUDED.url, thumbnail_url = EXCLUDED.thumbnail_url, upvotes = EXCLUDED.upvotes, downvotes = EXCLUDED.downvotes, favorites = EXCLUDED.favorites, views = EXCLUDED.views, deleted = EXCLUDED.deleted, unlisted = EXCLUDED.unlisted, updated_at = EXCLUDED.updated_at RETURNING id, sequential_id`, values));
        }
      }
      const imgResults = await Promise.all(imgPromises);
      for (const res of imgResults) for (const row of res.rows) imageSeqIdToPgId.set(row.sequential_id, row.id);
      for (const img of deduplicatedChunk) if (existingImgIds.has(parseInt(img.sequentialId || img.sequential_id))) imageSeqIdToPgId.set(parseInt(img.sequentialId || img.sequential_id), existingImgIds.get(parseInt(img.sequentialId || img.sequential_id))!);

      for (const img of deduplicatedChunk) {
        const seqId = parseInt(img.sequentialId || img.sequential_id);
        if (!isNaN(seqId) && img._id) {
          const pgId = imageSeqIdToPgId.get(seqId);
          if (pgId) {
            mongoIdToPgId.set(img._id.toString(), pgId);
          }
        }
      }

      const junctionQueue: { image_id: number; tag_id: number }[] = [];
      const newTagsToCreate = new Map<string, string>();
      for (const img of deduplicatedChunk) {
        const pgImgId = imageSeqIdToPgId.get(parseInt(img.sequentialId || img.sequential_id));
        if (!pgImgId) continue;
        const tagsArray = Array.isArray(img.tags) ? img.tags : [];
        for (const t of tagsArray) {
          const tagName = typeof t === 'string' ? t.trim() : (t && t.name ? t.name.trim() : null);
          if (!tagName) continue;
          let pgTagId = tagNameMap.get(tagName);
          if (!pgTagId) newTagsToCreate.set(tagName, typeof t === 'object' && t.type ? t.type : 'general');
          else junctionQueue.push({ image_id: pgImgId, tag_id: pgTagId });
        }
      }

      if (newTagsToCreate.size > 0) {
        const missingTagsArray = Array.from(newTagsToCreate.entries());
        const missingPromises = [];
        for (let i = 0; i < missingTagsArray.length; i += 10000) {
          const subChunk = missingTagsArray.slice(i, i + 10000);
          const tPlaceholders = []; const tValues = []; let tIdx = 1;
          for (const [tName, tType] of subChunk) { tPlaceholders.push(`($${tIdx}, $${tIdx+1})`); tValues.push(tName, tType); tIdx += 2; }
          missingPromises.push(pgPool.query(`INSERT INTO tags (name, type) VALUES ${tPlaceholders.join(', ')} ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name`, tValues));
        }
        const tagRes = await Promise.all(missingPromises);
        for (const res of tagRes) for (const row of res.rows) tagNameMap.set(row.name, row.id);
        
        for (const img of deduplicatedChunk) {
          const pgImgId = imageSeqIdToPgId.get(parseInt(img.sequentialId || img.sequential_id));
          if (!pgImgId) continue;
          const tagsArray = Array.isArray(img.tags) ? img.tags : [];
          for (const t of tagsArray) {
            const tagName = typeof t === 'string' ? t.trim() : (t && t.name ? t.name.trim() : null);
            if (!tagName) continue;
            if (newTagsToCreate.has(tagName)) junctionQueue.push({ image_id: pgImgId, tag_id: tagNameMap.get(tagName)! });
          }
        }
      }

      if (junctionQueue.length > 0) {
        const uniqueJunctionMap = new Set<string>();
        const deduplicatedJunctions: { image_id: number; tag_id: number }[] = [];
        for (const item of junctionQueue) {
          const key = `${item.image_id}-${item.tag_id}`;
          if (!uniqueJunctionMap.has(key)) { uniqueJunctionMap.add(key); deduplicatedJunctions.push(item); }
        }
        const jPromises = [];
        for (let k = 0; k < deduplicatedJunctions.length; k += 15000) {
          const jChunk = deduplicatedJunctions.slice(k, k + 15000);
          const jPlaceholders: string[] = []; const jValues: any[] = []; let jIdx = 1;
          for (const item of jChunk) { jPlaceholders.push(`($${jIdx}, $${jIdx+1})`); jValues.push(item.image_id, item.tag_id); jIdx += 2; }
          if (jValues.length > 0) jPromises.push(pgPool.query(`INSERT INTO image_tags (image_id, tag_id) VALUES ${jPlaceholders.join(', ')} ON CONFLICT DO NOTHING`, jValues));
        }
        await Promise.all(jPromises);
      }
    });

    // --- PHASE 4: VOTES ---
    if (!skipVotes) {
      console.log('🗳️  Migrating votes...');
      await migrateCollectionInBatches<any>(mdb, 'votes', 100000, null, async (chunk) => {
        const uniqueVotesMap = new Map<string, any>();
        for (const v of chunk) {
          const userId = (v.userId || v.user_id)?.toString();
          const mongoId = (v.imageId || v.image_id)?.toString();
          const pgImgId = mongoId ? mongoIdToPgId.get(mongoId) : undefined;
          if (!userId || !pgImgId) continue;
          v.pgImgId = pgImgId;
          uniqueVotesMap.set(`${userId}-${pgImgId}`, v);
        }
        const deduplicatedVotes = Array.from(uniqueVotesMap.values());
        
        const uniqueUserIds = Array.from(new Set(deduplicatedVotes.map(v => (v.userId || v.user_id).toString())));
        await Promise.all(uniqueUserIds.map(userId => ensureUserExists(pgPool, userId, `user_${userId.slice(-6)}`)));

        const vPromises = [];
        for (let i = 0; i < deduplicatedVotes.length; i += 15000) {
          const subChunk = deduplicatedVotes.slice(i, i + 15000);
          const placeholders: string[] = []; const values: any[] = []; let idx = 1;
          for (const v of subChunk) {
            placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3})`);
            values.push((v.userId || v.user_id).toString(), v.pgImgId, v.type || 'upvote', v.createdAt || v.created_at || new Date());
            idx += 4;
          }
          if (values.length > 0) vPromises.push(pgPool.query(`INSERT INTO votes (user_id, image_id, type, created_at) VALUES ${placeholders.join(', ')} ON CONFLICT (user_id, image_id) DO UPDATE SET type = EXCLUDED.type`, values));
        }
        await Promise.all(vPromises);
      });
      console.log(`✅ Completed votes migration.\n`);
    }

    // --- PHASE 5: FAVORITES ---
    if (!skipFavorites) {
      console.log('❤️  Migrating favorites...');
      await migrateCollectionInBatches<any>(mdb, 'favorites', 100000, null, async (chunk) => {
        const uniqueFavsMap = new Map<string, any>();
        for (const f of chunk) {
          const userId = (f.userId || f.user_id)?.toString();
          const mongoId = (f.imageId || f.image_id)?.toString();
          const pgImgId = mongoId ? mongoIdToPgId.get(mongoId) : undefined;
          if (!userId || !pgImgId) continue;
          f.pgImgId = pgImgId;
          uniqueFavsMap.set(`${userId}-${pgImgId}`, f);
        }
        const deduplicatedFavs = Array.from(uniqueFavsMap.values());

        const uniqueUserIds = Array.from(new Set(deduplicatedFavs.map(f => (f.userId || f.user_id).toString())));
        await Promise.all(uniqueUserIds.map(userId => ensureUserExists(pgPool, userId, `user_${userId.slice(-6)}`)));

        const fPromises = [];
        for (let i = 0; i < deduplicatedFavs.length; i += 20000) {
          const subChunk = deduplicatedFavs.slice(i, i + 20000);
          const placeholders: string[] = []; const values: any[] = []; let idx = 1;
          for (const f of subChunk) {
            placeholders.push(`($${idx}, $${idx+1}, $${idx+2})`);
            values.push((f.userId || f.user_id).toString(), f.pgImgId, f.createdAt || f.created_at || new Date());
            idx += 3;
          }
          if (values.length > 0) fPromises.push(pgPool.query(`INSERT INTO favorites (user_id, image_id, created_at) VALUES ${placeholders.join(', ')} ON CONFLICT (user_id, image_id) DO NOTHING`, values));
        }
        await Promise.all(fPromises);
      });
      console.log(`✅ Completed favorites migration.\n`);
    }

    // --- PHASE 6: COMMENTS ---
    console.log('💬 Migrating comments...');
    await migrateCollectionInBatches<any>(mdb, 'comments', 20000, null, async (chunk) => {
      const uniqueUserIds = Array.from(new Set(chunk.map(c => c.userId ? c.userId.toString() : (c.user_id ? c.user_id.toString() : null)).filter(Boolean)));
      await Promise.all(uniqueUserIds.map((userId: string) => ensureUserExists(pgPool, userId, `user_${userId.slice(-6)}`)));

      const cPromises = [];
      for (let i = 0; i < chunk.length; i += 6000) {
        const subChunk = chunk.slice(i, i + 6000);
        const placeholders: string[] = []; const values: any[] = []; let idx = 1;
        for (const c of subChunk) {
          const mongoId = (c.imageId || c.image_id)?.toString();
          const pgImgId = mongoId ? mongoIdToPgId.get(mongoId) : undefined;
          const userId = c.userId ? c.userId.toString() : (c.user_id ? c.user_id.toString() : null);
          if (!pgImgId || !userId) continue;
          placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, NULL, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9})`);
          values.push(pgImgId, userId, c.username || 'Anonymous', c.avatarUrl || c.avatar_url || null, c.rank || 'user', c.content, c.asArtist || c.as_artist || false, c.artistTagId || c.artist_tag_id || null, c.createdAt || c.created_at || new Date(), c.updatedAt || c.updated_at || new Date());
          idx += 10;
        }
        if (values.length > 0) cPromises.push(pgPool.query(`INSERT INTO comments (image_id, user_id, username, avatar_url, rank, content, parent_id, as_artist, artist_tag_id, created_at, updated_at) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`, values));
      }
      await Promise.all(cPromises);
    });

    // --- PHASE 7: IMPORT JOBS ---
    console.log('📦 Migrating import jobs...');
    try {
      let collectionName = 'import_jobs';
      const collections = await mdb.listCollections().toArray();
      const names = collections.map((c: any) => c.name);
      if (!names.includes('import_jobs') && names.includes('importJobs')) {
        collectionName = 'importJobs';
      }
      
      await migrateCollectionInBatches<any>(mdb, collectionName, 20000, null, async (chunk) => {
        const promises = [];
        for (const j of chunk) {
          const type = j.type || 'tags';
          const queryVal = j.query || '';
          const limitVal = parseInt(j.limit || j.limit_val) || 100;
          const status = j.status || 'pending';
          const progress = JSON.stringify(j.progress || { current: 0, total: 0, successful: 0, failed: 0, skipped: 0 });
          const posts = JSON.stringify(j.posts || []);
          const currentIndex = parseInt(j.currentPostIndex || j.current_post_index) || 0;
          const errorVal = j.error || null;
          const createdBy = j.createdBy || j.created_by || 'system';
          const startedAt = j.startedAt || j.started_at || null;
          const completedAt = j.completedAt || j.completed_at || null;
          const createdAt = j.createdAt || j.created_at || new Date();

          promises.push(pgPool.query(
            `INSERT INTO import_jobs (
               type, query, limit_val, status, progress, posts, current_post_index,
               error, created_by, started_at, completed_at, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT DO NOTHING`,
            [
              type, queryVal, limitVal, status, progress, posts, currentIndex,
              errorVal, createdBy, startedAt, completedAt, createdAt
            ]
          ));
        }
        await Promise.all(promises);
      });
      console.log('✅ Completed import jobs migration.\n');
    } catch (err: any) {
      console.log(`⚠️ Warning: Failed to migrate import jobs: ${err.message}`);
    }

  } catch (error) {
    console.error('\n❌ Migration Failed:', error);
  } finally {
    await pgPool.end();
    await mongoClient.close();
    process.exit(0);
  }
}

main().catch(console.error);
