import { MongoClient, ObjectId } from 'mongodb';

// Load env manually
import { readFileSync } from 'fs';
const envContent = readFileSync('.env.local', 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
});

async function cleanup() {
  const mongoUri = envVars.MONGO_URI;
  const mongoDb = envVars.MONGO_DB;
  console.log('Connecting to:', mongoDb);
  
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(mongoDb);
  
  const imagesCollection = db.collection('images');
  const tagsCollection = db.collection('tags');
  
  // Only find images with the specific profile description pattern
  const profileImages = await imagesCollection.find({
    description: { $regex: 'Artist (avatar|banner) for', $options: 'i' }
  }).toArray();
  
  console.log(`Found ${profileImages.length} profile images to delete:`);
  for (const img of profileImages) {
    console.log(`  - ${img._id}: "${img.description}" (seq: ${img.sequentialId})`);
  }
  
  if (profileImages.length > 0) {
    const ids = profileImages.map(img => img._id);
    const result = await imagesCollection.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${result.deletedCount} images`);
  }
  
  // Also delete the profile_image tag if it still exists
  const profileTag = await tagsCollection.findOne({ name: 'profile_image' });
  if (profileTag) {
    await tagsCollection.deleteOne({ _id: profileTag._id });
    console.log('Deleted profile_image tag');
  }
  
  await client.close();
}

cleanup().catch(console.error);
