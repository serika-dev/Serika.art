/**
 * Database Index Setup Script
 * 
 * Run this script to create all necessary indexes for optimal performance
 * with 1.5M+ images.
 * 
 * Usage: bun scripts/setup-indexes.ts
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load env vars from .env.local
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        // Remove quotes if present
        process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    });
  } catch (e) {
    console.log('Could not load .env.local, using existing env vars');
  }
}

loadEnv();

const MONGO_URI = process.env.MONGO_URI!;
const MONGO_DB = process.env.MONGO_DB!;

// Helper to create index safely (ignores if already exists)
async function safeCreateIndex(
  collection: any,
  keys: any,
  options: any,
  description: string
) {
  try {
    await collection.createIndex(keys, options);
    console.log(`  ✓ ${description}`);
  } catch (error: any) {
    if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
      // Index exists with different name - that's fine
      console.log(`  ⊘ ${description} (already exists)`);
    } else if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
      // Index exists with different options
      console.log(`  ⊘ ${description} (exists with different options)`);
    } else {
      console.log(`  ✗ ${description}: ${error.message}`);
    }
  }
}

async function setupIndexes() {
  console.log('Connecting to MongoDB...');
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db(MONGO_DB);
  
  console.log('Setting up indexes for optimal performance...\n');

  // Images collection indexes
  const imagesCollection = db.collection('images');
  
  console.log('Creating indexes on images collection...');
  
  // Primary sorting indexes (compound for efficient sorting with filtering)
  await safeCreateIndex(
    imagesCollection,
    { createdAt: -1 },
    { background: true, name: 'idx_createdAt_desc' },
    'createdAt descending index'
  );
  
  await safeCreateIndex(
    imagesCollection,
    { upvotes: -1, views: -1 },
    { background: true, name: 'idx_popular' },
    'popularity (upvotes + views) index'
  );
  
  await safeCreateIndex(
    imagesCollection,
    { favorites: -1 },
    { background: true, name: 'idx_favorites_desc' },
    'favorites descending index'
  );
  
  await safeCreateIndex(
    imagesCollection,
    { views: -1 },
    { background: true, name: 'idx_views_desc' },
    'views descending index'
  );
  
  // Rating filter index (commonly used)
  await safeCreateIndex(
    imagesCollection,
    { rating: 1, createdAt: -1 },
    { background: true, name: 'idx_rating_createdAt' },
    'rating + createdAt compound index'
  );
  
  // AI filter index
  await safeCreateIndex(
    imagesCollection,
    { isAIGenerated: 1, createdAt: -1 },
    { background: true, name: 'idx_ai_createdAt' },
    'isAIGenerated + createdAt compound index'
  );
  
  // Tags array index (for tag filtering)
  await safeCreateIndex(
    imagesCollection,
    { tags: 1 },
    { background: true, name: 'idx_tags' },
    'tags array index'
  );
  
  // Compound index for common query pattern (rating + AI + sort)
  await safeCreateIndex(
    imagesCollection,
    { rating: 1, isAIGenerated: 1, createdAt: -1 },
    { background: true, name: 'idx_rating_ai_createdAt' },
    'rating + isAIGenerated + createdAt compound index'
  );
  
  // User filtering
  await safeCreateIndex(
    imagesCollection,
    { userId: 1, createdAt: -1 },
    { background: true, name: 'idx_userId_createdAt' },
    'userId + createdAt compound index'
  );
  
  await safeCreateIndex(
    imagesCollection,
    { username: 1, createdAt: -1 },
    { background: true, name: 'idx_username_createdAt' },
    'username + createdAt compound index'
  );
  
  // Sequential ID for direct access
  await safeCreateIndex(
    imagesCollection,
    { sequentialId: 1 },
    { background: true, unique: true, sparse: true, name: 'idx_sequentialId' },
    'sequentialId unique index'
  );
  
  // Danbooru ID for import deduplication
  await safeCreateIndex(
    imagesCollection,
    { 'metadata.danbooruId': 1 },
    { background: true, sparse: true, name: 'idx_danbooruId' },
    'danbooruId sparse index'
  );

  // Tags collection indexes
  const tagsCollection = db.collection('tags');
  
  console.log('\nCreating indexes on tags collection...');
  
  await safeCreateIndex(
    tagsCollection,
    { name: 1 },
    { background: true, unique: true, name: 'idx_tag_name' },
    'name unique index'
  );
  
  await safeCreateIndex(
    tagsCollection,
    { name: 'text' },
    { background: true, name: 'idx_tag_name_text' },
    'name text search index'
  );
  
  await safeCreateIndex(
    tagsCollection,
    { count: -1, name: 1 },
    { background: true, name: 'idx_tag_count_name' },
    'count + name compound index'
  );
  
  await safeCreateIndex(
    tagsCollection,
    { type: 1, count: -1 },
    { background: true, name: 'idx_tag_type_count' },
    'type + count compound index'
  );

  // Users collection indexes
  const usersCollection = db.collection('users');
  
  console.log('\nCreating indexes on users collection...');
  
  await safeCreateIndex(
    usersCollection,
    { serikaId: 1 },
    { background: true, unique: true, sparse: true, name: 'idx_serikaId' },
    'serikaId unique index'
  );
  
  await safeCreateIndex(
    usersCollection,
    { username: 1 },
    { background: true, unique: true, name: 'idx_username' },
    'username unique index'
  );
  
  await safeCreateIndex(
    usersCollection,
    { email: 1 },
    { background: true, sparse: true, name: 'idx_email' },
    'email index'
  );

  // Import jobs collection indexes
  const jobsCollection = db.collection('import_jobs');
  
  console.log('\nCreating indexes on import_jobs collection...');
  
  await safeCreateIndex(
    jobsCollection,
    { status: 1, createdAt: 1 },
    { background: true, name: 'idx_job_status_createdAt' },
    'status + createdAt compound index'
  );

  // Favorites collection indexes (if exists)
  try {
    const favoritesCollection = db.collection('favorites');
    console.log('\nCreating indexes on favorites collection...');
    
    await safeCreateIndex(
      favoritesCollection,
      { userId: 1, imageId: 1 },
      { background: true, unique: true, name: 'idx_favorite_user_image' },
      'userId + imageId compound unique index'
    );
    
    await safeCreateIndex(
      favoritesCollection,
      { userId: 1, createdAt: -1 },
      { background: true, name: 'idx_favorite_userId_createdAt' },
      'userId + createdAt compound index'
    );
  } catch (e) {
    console.log('  (favorites collection not found, skipping)');
  }

  console.log('\n✅ Index setup complete!');
  console.log('\nTip: Run db.images.getIndexes() in MongoDB shell to verify indexes.');
  
  await client.close();
}

setupIndexes().catch(console.error);
