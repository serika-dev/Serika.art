require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { Pool } = require('pg');

async function fixComments() {
  const mongoClient = await MongoClient.connect(process.env.MONGO_URI);
  const mdb = mongoClient.db(process.env.MONGO_DB || 'serika-art');
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL, max: 10 });

  try {
    console.log('Fetching all comments from MongoDB...');
    const comments = await mdb.collection('comments').find({}).toArray();
    console.log(`Found ${comments.length} comments.`);

    let success = 0;
    let failed = 0;

    for (const c of comments) {
      if (!c.imageId && !c.image_id) {
        failed++;
        continue;
      }
      
      const mongoIdStr = (c.imageId || c.image_id).toString();
      const mongoImg = await mdb.collection('images').findOne({ _id: c.imageId || c.image_id });
      
      if (!mongoImg) {
        console.log(`Could not find image in Mongo for comment ${c._id}`);
        failed++;
        continue;
      }
      
      const seqId = parseInt(mongoImg.sequentialId || mongoImg.sequential_id);
      
      const pgImgRes = await pgPool.query(`SELECT id FROM images WHERE sequential_id = $1`, [seqId]);
      if (pgImgRes.rows.length === 0) {
        console.log(`Could not find image in Postgres for sequential_id ${seqId}`);
        failed++;
        continue;
      }
      
      const pgImgId = pgImgRes.rows[0].id;
      
      const userId = c.userId ? c.userId.toString() : (c.user_id ? c.user_id.toString() : null);
      if (!userId) {
        failed++;
        continue;
      }
      
      const userRes = await pgPool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
      const finalUserId = userRes.rows.length > 0 ? userId : 'system';
      
      try {
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
        success++;
      } catch (err) {
        console.error('Error inserting comment:', err.message);
        failed++;
      }
    }
    
    console.log(`Completed. Success: ${success}, Failed: ${failed}`);
  } finally {
    await pgPool.end();
    await mongoClient.close();
  }
}

fixComments().catch(console.error);
