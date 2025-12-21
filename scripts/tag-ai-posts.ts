import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI!;
const MONGO_DB = process.env.MONGO_DB || 'serika-art';

// AI-related tag names (normalized with spaces, as stored in the database)
const AI_TAG_NAMES = [
  'ai-generated',
  'ai-assisted',
  'ai generated',
  'ai assisted',
  'stable diffusion',
  'midjourney',
  'novelai',
  'nai diffusion',
  'dalle',
  'dall-e',
  'dall e',
];

async function tagAIPosts() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(MONGO_DB);
    const imagesCollection = db.collection('images');
    const tagsCollection = db.collection('tags');
    
    // Find all AI-related tags
    const aiTags = await tagsCollection
      .find({
        $or: AI_TAG_NAMES.map(name => ({ name: { $regex: new RegExp(`^${name}$`, 'i') } }))
      })
      .toArray();
    
    console.log(`Found ${aiTags.length} AI-related tags in database:`);
    aiTags.forEach(tag => console.log(`  - ${tag.name} (${tag.type})`));
    
    if (aiTags.length === 0) {
      console.log('No AI tags found in database. Exiting.');
      return;
    }
    
    const aiTagIds = aiTags.map(tag => tag._id);
    
    // Find all images that have any of these AI tags but are not marked as AI generated
    const imagesToUpdate = await imagesCollection
      .find({
        tags: { $in: aiTagIds },
        isAIGenerated: { $ne: true }
      })
      .toArray();
    
    console.log(`\nFound ${imagesToUpdate.length} images with AI tags that need to be marked as AI generated`);
    
    if (imagesToUpdate.length === 0) {
      console.log('All images with AI tags are already marked. Exiting.');
      return;
    }
    
    // Update all these images
    const result = await imagesCollection.updateMany(
      {
        tags: { $in: aiTagIds },
        isAIGenerated: { $ne: true }
      },
      {
        $set: { isAIGenerated: true }
      }
    );
    
    console.log(`\n✅ Updated ${result.modifiedCount} images to be marked as AI generated`);
    
    // Also check for images imported from Danbooru that might have AI tags in metadata
    const danbooruImages = await imagesCollection
      .find({
        'metadata.danbooruId': { $exists: true },
        isAIGenerated: { $ne: true }
      })
      .toArray();
    
    console.log(`\nFound ${danbooruImages.length} Danbooru images that might need AI tagging check`);
    
    // For each Danbooru image, check its tags
    let danbooruUpdated = 0;
    for (const image of danbooruImages) {
      const hasAITag = image.tags?.some((tagId: ObjectId) => 
        aiTagIds.some(aiId => aiId.toString() === tagId.toString())
      );
      
      if (hasAITag) {
        await imagesCollection.updateOne(
          { _id: image._id },
          { $set: { isAIGenerated: true } }
        );
        danbooruUpdated++;
      }
    }
    
    if (danbooruUpdated > 0) {
      console.log(`✅ Additionally updated ${danbooruUpdated} Danbooru images as AI generated`);
    }
    
    console.log('\n✅ AI tagging migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

tagAIPosts();
