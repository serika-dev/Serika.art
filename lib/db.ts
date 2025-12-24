import { MongoClient, Db } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI!;
const MONGO_DB = process.env.MONGO_DB!;

if (!MONGO_URI) {
  throw new Error('Please define MONGO_URI in .env.local');
}

if (!MONGO_DB) {
  throw new Error('Please define MONGO_DB in .env.local');
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let indexesInitialized = false;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(MONGO_URI, {
    // Connection pool settings for better performance
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 60000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  const db = client.db(MONGO_DB);

  cachedClient = client;
  cachedDb = db;

  // Initialize critical indexes on first connection (non-blocking)
  if (!indexesInitialized) {
    indexesInitialized = true;
    ensureCriticalIndexes(db).catch(console.error);
  }

  return { client, db };
}

// Ensure critical indexes exist (runs once on startup)
async function ensureCriticalIndexes(db: Db) {
  try {
    const images = db.collection('images');
    const tags = db.collection('tags');

    // Create indexes in background (won't block queries)
    await Promise.all([
      // Images: primary sort indexes
      images.createIndex({ createdAt: -1 }, { background: true }).catch(() => {}),
      images.createIndex({ rating: 1, createdAt: -1 }, { background: true }).catch(() => {}),
      images.createIndex({ rating: 1, isAIGenerated: 1, createdAt: -1 }, { background: true }).catch(() => {}),
      images.createIndex({ tags: 1 }, { background: true }).catch(() => {}),
      images.createIndex({ sequentialId: 1 }, { background: true, unique: true, sparse: true }).catch(() => {}),
      
      // Tags: name lookup and sorting
      tags.createIndex({ name: 1 }, { background: true, unique: true }).catch(() => {}),
      tags.createIndex({ count: -1, name: 1 }, { background: true }).catch(() => {}),
    ]);

    console.log('[DB] Critical indexes ensured');
  } catch (error) {
    console.error('[DB] Error ensuring indexes:', error);
  }
}

export async function getCollection(collectionName: string) {
  const { db } = await connectToDatabase();
  return db.collection(collectionName);
}

// Cached count for large collections (refreshes every 5 minutes)
const countCache = new Map<string, { count: number; timestamp: number }>();
const COUNT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedCount(collectionName: string, query: any = {}): Promise<number> {
  const cacheKey = `${collectionName}:${JSON.stringify(query)}`;
  const cached = countCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < COUNT_CACHE_TTL) {
    return cached.count;
  }
  
  const collection = await getCollection(collectionName);
  
  // For empty queries on large collections, use estimatedDocumentCount (much faster)
  let count: number;
  if (Object.keys(query).length === 0) {
    count = await collection.estimatedDocumentCount();
  } else {
    count = await collection.countDocuments(query);
  }
  
  countCache.set(cacheKey, { count, timestamp: Date.now() });
  return count;
}
