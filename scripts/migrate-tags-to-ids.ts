import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || '';

if (!MONGO_URI) {
  console.error('MONGO_URI environment variable is not set');
  process.exit(1);
}

interface OldImage {
  _id: ObjectId;
  tags: Array<{ name: string; type: string }>;
}

async function migrateTagsToIds() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db('serika-art');
    const imagesCollection = db.collection('images');
    const tagsCollection = db.collection('tags');

    console.log('Starting migration of tags to ObjectIDs...');

    // Get all images
    const images = (await imagesCollection.find({}).toArray()) as OldImage[];
    console.log(`Found ${images.length} images to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const image of images) {
      try {
        // Skip if tags are already ObjectIDs
        if (image.tags && image.tags.length > 0 && image.tags[0] instanceof ObjectId) {
          console.log(`Image ${image._id} already has ObjectID tags, skipping`);
          continue;
        }

        // Skip if tags don't exist or are empty
        if (!image.tags || image.tags.length === 0) {
          console.log(`Image ${image._id} has no tags, skipping`);
          continue;
        }

        // Resolve tag names to ObjectIDs
        const tagIds: ObjectId[] = [];
        for (const tagInfo of image.tags) {
          const tagName = typeof tagInfo === 'string' ? tagInfo : tagInfo.name;
          const tag = await tagsCollection.findOne({ name: tagName.toLowerCase() });
          
          if (tag) {
            tagIds.push(tag._id);
          } else {
            console.warn(`Tag "${tagName}" not found for image ${image._id}, skipping this tag`);
          }
        }

        // Update image with new tag IDs
        if (tagIds.length > 0) {
          await imagesCollection.updateOne(
            { _id: image._id },
            { $set: { tags: tagIds } }
          );
          console.log(`✓ Migrated image ${image._id} with ${tagIds.length} tags`);
          migratedCount++;
        } else {
          console.warn(`Image ${image._id} has no valid tags after migration`);
          errorCount++;
        }
      } catch (error: any) {
        console.error(`Error migrating image ${image._id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Errors: ${errorCount}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrateTagsToIds();
