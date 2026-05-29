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

const mongoUri = process.env.MONGO_URI;
const mongoDbName = process.env.MONGO_DB || 'serika-art';
const postgresUrl = process.env.POSTGRES_URL;

if (!mongoUri || !postgresUrl) {
  console.error("Missing MONGO_URI or POSTGRES_URL");
  process.exit(1);
}

async function main() {
  console.log('🚀 Starting FAST Image Tags Junction Fix\n');
  const mongoClient = await MongoClient.connect(mongoUri!);
  const mdb = mongoClient.db(mongoDbName);
  const pgPool = new Pool({ connectionString: postgresUrl, max: 20 });

  try {
    console.log('🔄 Loading PostgreSQL tags (Name -> PG_ID)...');
    const pgTagsMap = new Map<string, number>();
    const tagRes = await pgPool.query('SELECT id, name FROM tags');
    for (const row of tagRes.rows) {
      pgTagsMap.set(row.name, row.id);
    }
    console.log(`✅ Loaded ${pgTagsMap.size} tags from PostgreSQL.\n`);

    console.log('🔄 Loading MongoDB tags (Mongo_ID -> Name)...');
    const mongoTags = await mdb.collection('tags').find({}).toArray();
    const mongoIdToPgId = new Map<string, number>();
    
    for (const mt of mongoTags) {
      if (!mt.name || !mt.name.trim()) continue;
      const mId = mt._id.toString();
      const name = mt.name.trim();
      const pgId = pgTagsMap.get(name);
      if (pgId) {
        mongoIdToPgId.set(mId, pgId);
      }
    }
    console.log(`✅ Mapped ${mongoIdToPgId.size} MongoDB tag IDs to PostgreSQL tag IDs.\n`);

    console.log('🔄 Loading image sequential ID mappings from PostgreSQL...');
    const imageSeqIdToPgId = new Map<number, number>();
    const imgRes = await pgPool.query('SELECT id, sequential_id FROM images');
    for (const row of imgRes.rows) {
      imageSeqIdToPgId.set(row.sequential_id, row.id);
    }
    console.log(`✅ Loaded ${imageSeqIdToPgId.size} sequential ID mappings.\n`);

    console.log('🖼️  Migrating image tags junction...');
    const imagesCursor = mdb.collection('images').find({});
    
    let batch: any[] = [];
    const batchSize = 50000;
    let totalProcessed = 0;
    let totalJunctions = 0;

    async function processBatch(docs: any[]) {
      const deduplicatedJunctionsMap = new Map<string, { image_id: number; tag_id: number }>();
      
      for (const img of docs) {
        const seqId = parseInt(img.sequentialId || img.sequential_id);
        if (isNaN(seqId)) continue;
        const pgImgId = imageSeqIdToPgId.get(seqId);
        if (!pgImgId) continue;

        const tagsArray = Array.isArray(img.tags) ? img.tags : [];
        for (const t of tagsArray) {
          const tId = t ? t.toString() : null;
          if (!tId) continue;
          
          const pgTagId = mongoIdToPgId.get(tId);
          if (pgTagId) {
            deduplicatedJunctionsMap.set(`${pgImgId}-${pgTagId}`, { image_id: pgImgId, tag_id: pgTagId });
          }
        }
      }

      const deduplicatedJunctions = Array.from(deduplicatedJunctionsMap.values());
      if (deduplicatedJunctions.length === 0) return;

      const jPromises = [];
      const chunkSize = 15000;
      
      for (let k = 0; k < deduplicatedJunctions.length; k += chunkSize) {
        const jChunk = deduplicatedJunctions.slice(k, k + chunkSize);
        const jPlaceholders: string[] = [];
        const jValues: any[] = [];
        let jIdx = 1;

        for (const item of jChunk) {
          jPlaceholders.push(`($${jIdx}, $${jIdx+1})`);
          jValues.push(item.image_id, item.tag_id);
          jIdx += 2;
        }

        if (jValues.length > 0) {
          jPromises.push(pgPool.query(`
            INSERT INTO image_tags (image_id, tag_id) 
            VALUES ${jPlaceholders.join(', ')} 
            ON CONFLICT DO NOTHING
          `, jValues));
        }
      }
      
      await Promise.all(jPromises);
      totalJunctions += deduplicatedJunctions.length;
    }

    while (await imagesCursor.hasNext()) {
      const doc = await imagesCursor.next();
      if (doc) {
        batch.push(doc);
        if (batch.length >= batchSize) {
          await processBatch(batch);
          totalProcessed += batch.length;
          process.stdout.write(`\r  Processed ${totalProcessed} images. Inserted ${totalJunctions} tag junctions...`);
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      await processBatch(batch);
      totalProcessed += batch.length;
    }

    console.log(`\n\n✅ COMPLETED. Processed ${totalProcessed} images and inserted ${totalJunctions} tag junctions.`);
    
  } catch (error) {
    console.error('\n❌ Migration Failed:', error);
  } finally {
    await pgPool.end();
    await mongoClient.close();
    process.exit(0);
  }
}

main().catch(console.error);
