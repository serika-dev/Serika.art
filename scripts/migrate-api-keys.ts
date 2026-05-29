import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrateApiKeys() {
  const mongoClient = new MongoClient(process.env.MONGO_URI as string);
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    await mongoClient.connect();
    console.log('Connected to MongoDB');
    
    const db = mongoClient.db(process.env.MONGO_DB);
    
    // Check possible collection names
    const collections = await db.listCollections().toArray();
    console.log('Mongo Collections:', collections.map(c => c.name).filter(n => n.toLowerCase().includes('key')));
    
    const apiKeysColl = db.collection('apikeys'); // usually apikeys or api_keys
    const mongoKeys = await apiKeysColl.find({}).toArray();
    
    console.log(`Found ${mongoKeys.length} API keys in MongoDB (apikeys)`);
    
    if (mongoKeys.length === 0) {
      const api_keysColl = db.collection('api_keys');
      const mongoKeys2 = await api_keysColl.find({}).toArray();
      console.log(`Found ${mongoKeys2.length} API keys in MongoDB (api_keys)`);
      if (mongoKeys2.length > 0) mongoKeys.push(...mongoKeys2);
    }
    
    let success = 0;
    let failed = 0;
    
    for (const key of mongoKeys) {
      try {
        await pgPool.query(
          `INSERT INTO api_keys (
            user_id, username, name, key_hash, permissions, rate_limit,
            usage_count, expires_at, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT DO NOTHING`,
          [
            key.userId?.toString() || key.user_id?.toString() || null,
            key.username || 'unknown',
            key.name || 'Migrated Key',
            key.keyHash || key.key_hash || '',
            key.permissions || ['read'],
            key.rateLimit || key.rate_limit || 60,
            key.usageCount || key.usage_count || 0,
            key.expiresAt || key.expires_at || null,
            key.isActive !== undefined ? key.isActive : true,
            key.createdAt || key.created_at || new Date(),
            key.updatedAt || key.updated_at || new Date()
          ]
        );
        success++;
      } catch (e) {
        console.error('Failed to migrate key:', key._id, e.message);
        failed++;
      }
    }
    
    console.log(`\nMigration Complete:`);
    console.log(`Successfully migrated: ${success}`);
    console.log(`Failed to migrate: ${failed}`);
    
  } catch (e) {
    console.error('Fatal error:', e);
  } finally {
    await mongoClient.close();
    await pgPool.end();
  }
}

migrateApiKeys();
