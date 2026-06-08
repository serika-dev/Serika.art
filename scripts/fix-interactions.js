require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { Pool } = require('pg');

async function migrateCollection(mdb, pgPool, collectionName, pgTableName, insertFn) {
  console.log(`Fetching all ${collectionName} from MongoDB...`);
  const items = await mdb.collection(collectionName).find({}).toArray();
  console.log(`Found ${items.length} ${collectionName}.`);

  let success = 0;
  let failed = 0;

  for (const item of items) {
    if (!item.imageId && !item.image_id) {
      failed++;
      continue;
    }
    
    const mongoImgId = item.imageId || item.image_id;
    const mongoImg = await mdb.collection('images').findOne({ _id: mongoImgId });
    
    if (!mongoImg) {
      // Image might have been deleted in mongo, skip
      failed++;
      continue;
    }
    
    const seqId = parseInt(mongoImg.sequentialId || mongoImg.sequential_id);
    
    const pgImgRes = await pgPool.query(`SELECT id FROM images WHERE sequential_id = $1`, [seqId]);
    if (pgImgRes.rows.length === 0) {
      // Image not migrated or doesn't exist in Postgres
      failed++;
      continue;
    }
    
    const pgImgId = pgImgRes.rows[0].id;
    
    const userId = item.userId ? item.userId.toString() : (item.user_id ? item.user_id.toString() : null);
    if (!userId) {
      failed++;
      continue;
    }
    
    const userRes = await pgPool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
    const finalUserId = userRes.rows.length > 0 ? userId : 'system';
    
    try {
      await insertFn(pgPool, item, pgImgId, finalUserId);
      success++;
    } catch (err) {
      console.error(`Error inserting ${collectionName}:`, err.message);
      failed++;
    }
  }
  
  console.log(`${collectionName} completed. Success: ${success}, Failed: ${failed}`);
}

async function fixInteractions() {
  const mongoClient = await MongoClient.connect(process.env.MONGO_URI);
  const mdb = mongoClient.db(process.env.MONGO_DB || 'serika-art');
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL, max: 10 });

  try {
    await migrateCollection(mdb, pgPool, 'comments', 'comments', async (pgPool, c, pgImgId, finalUserId) => {
      await pgPool.query(`
        INSERT INTO comments (
          image_id, user_id, username, avatar_url, rank, content,
          parent_id, as_artist, artist_tag_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10)
        ON CONFLICT DO NOTHING
      `, [
        pgImgId,
        finalUserId,
        c.username || 'Anonymous',
        c.avatarUrl || c.avatar_url || null,
        c.rank || 'user',
        c.content,
        c.asArtist || c.as_artist || false,
        c.artistTagId || c.artist_tag_id || null,
        c.createdAt || c.created_at || new Date(),
        c.updatedAt || c.updated_at || new Date()
      ]);
    });

    await migrateCollection(mdb, pgPool, 'votes', 'votes', async (pgPool, v, pgImgId, finalUserId) => {
      await pgPool.query(`
        INSERT INTO votes (user_id, image_id, type, created_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, image_id) DO UPDATE SET type = EXCLUDED.type
      `, [
        finalUserId, pgImgId, v.type || 'upvote', v.createdAt || v.created_at || new Date()
      ]);
    });

    await migrateCollection(mdb, pgPool, 'favorites', 'favorites', async (pgPool, f, pgImgId, finalUserId) => {
      await pgPool.query(`
        INSERT INTO favorites (user_id, image_id, created_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, image_id) DO NOTHING
      `, [
        finalUserId, pgImgId, f.createdAt || f.created_at || new Date()
      ]);
    });

  } finally {
    await pgPool.end();
    await mongoClient.close();
  }
}

fixInteractions().catch(console.error);
