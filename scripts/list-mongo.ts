import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function listCollections() {
  const mongoClient = new MongoClient(process.env.MONGO_URI as string);
  try {
    await mongoClient.connect();
    const db = mongoClient.db(process.env.MONGO_DB); // Make sure to use the correct DB!
    const collections = await db.listCollections().toArray();
    console.log('All Collections:', collections.map(c => c.name));
  } catch (e) {
    console.error(e);
  } finally {
    await mongoClient.close();
  }
}
listCollections();
