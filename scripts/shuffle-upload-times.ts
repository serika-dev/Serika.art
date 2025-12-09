import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || '';
const MONGO_DB = process.env.MONGO_DB || 'serika-art';

if (!MONGO_URI) {
  console.error('MONGO_URI environment variable is not set');
  process.exit(1);
}

function randomTimeOnSameDay(date: Date): Date {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const secondsInDay = 24 * 60 * 60;
  const randomSeconds = Math.floor(Math.random() * secondsInDay);
  const randomized = new Date(startOfDay.getTime() + randomSeconds * 1000);

  // Ensure we never set a future time if the day is today
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay && randomized.getTime() > now.getTime()) {
    // set to 1 minute in the past to stay on the same day and avoid future
    return new Date(now.getTime() - 60 * 1000);
  }

  return randomized;
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(MONGO_DB);
    const images = db.collection('images');

    console.log('Fetching images...');
    const docs = await images.find({}, { projection: { _id: 1, createdAt: 1 } }).toArray();
    console.log(`Found ${docs.length} images`);

    const bulkOps: any[] = [];

    for (const doc of docs) {
      const original = doc.createdAt ? new Date(doc.createdAt) : new Date();
      const newDate = randomTimeOnSameDay(original);
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id as ObjectId },
          update: { $set: { createdAt: newDate, updatedAt: newDate } },
        },
      });

      // Execute in batches of 500 to avoid huge payloads
      if (bulkOps.length === 500) {
        await images.bulkWrite(bulkOps);
        console.log('Updated 500 images...');
        bulkOps.length = 0;
      }
    }

    if (bulkOps.length > 0) {
      await images.bulkWrite(bulkOps);
      console.log(`Updated remaining ${bulkOps.length} images`);
    }

    console.log('Done shuffling upload times (dates preserved).');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
