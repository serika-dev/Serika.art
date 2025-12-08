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

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db(MONGO_DB);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export async function getCollection(collectionName: string) {
  const { db } = await connectToDatabase();
  return db.collection(collectionName);
}
