import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || '';
const MONGO_DB = process.env.MONGO_DB || 'serika-art';

if (!MONGO_URI) {
  console.error('MONGO_URI environment variable is not set');
  process.exit(1);
}

// Note: This script is compatible with sequential IDs
// After removing images, you may want to re-run add-sequential-ids.ts to maintain sequential order
async function removeAnonImages() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(MONGO_DB);
    const imagesCollection = db.collection('images');

    // Find all anonymous images
    const anonImages = await imagesCollection.find({ userId: null }).toArray();
    console.log(`Found ${anonImages.length} anonymous images`);

    if (anonImages.length === 0) {
      console.log('No anonymous images to remove');
      await client.close();
      process.exit(0);
    }

    // Get Danbooru IDs for reference
    const danbooruIds = anonImages
      .filter((img) => img.metadata?.danbooruId)
      .map((img) => img.metadata.danbooruId);

    if (danbooruIds.length > 0) {
      console.log(`Danbooru IDs: ${danbooruIds.join(', ')}`);
    }

    // Remove all anonymous images
    const result = await imagesCollection.deleteMany({ userId: null });
    console.log(`Deleted ${result.deletedCount} anonymous images`);

    // Decrement tag counts
    const tagsCollection = db.collection('tags');
    for (const image of anonImages) {
      const tags = image.tags || [];
      if (Array.isArray(tags) && tags.length > 0) {
        for (const tagId of tags) {
          await tagsCollection.updateOne(
            { _id: tagId },
            { $inc: { count: -1 } }
          );
        }
      }
    }

    console.log('Tag counts updated');
    console.log('Database reset complete');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

removeAnonImages();
