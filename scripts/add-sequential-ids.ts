import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI!;
const MONGO_DB = process.env.MONGO_DB || 'serika-art';

async function migrateToSequentialIds() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(MONGO_DB);
    const imagesCollection = db.collection('images');
    
    // Get all images sorted by creation date
    const images = await imagesCollection
      .find({})
      .sort({ createdAt: 1 })
      .toArray();
    
    console.log(`Found ${images.length} images to update`);
    
    // Update each image with a sequential ID
    for (let i = 0; i < images.length; i++) {
      const sequentialId = i + 1;
      await imagesCollection.updateOne(
        { _id: images[i]._id },
        { $set: { sequentialId } }
      );
      
      if ((i + 1) % 100 === 0) {
        console.log(`Updated ${i + 1}/${images.length} images`);
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log(`Total images updated: ${images.length}`);
    
    // Create unique index on sequentialId
    await imagesCollection.createIndex({ sequentialId: 1 }, { unique: true });
    console.log('✅ Created unique index on sequentialId');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrateToSequentialIds();
