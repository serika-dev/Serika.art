import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local manually
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key] = valueParts.join('=');
        }
      }
    }
  }
}

loadEnvFile();

const mongoUri = process.env.MONGO_URI!;
const mongoDbName = process.env.MONGO_DB || 'serika-art';

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  console.log(`Database: ${mongoDbName}\n`);
  
  const mongoClient = await MongoClient.connect(mongoUri);
  const db = mongoClient.db(mongoDbName);
  
  console.log('📊 Checking URL patterns in database...\n');
  
  // Check images
  const images = db.collection('images');
  const totalImages = await images.countDocuments();
  console.log(`Total images: ${totalImages}`);
  
  const sampleImage = await images.findOne({}, { projection: { url: 1, thumbnailUrl: 1 } });
  console.log('\nSample image URL:');
  console.log('  url:', sampleImage?.url);
  console.log('  thumbnailUrl:', sampleImage?.thumbnailUrl);
  
  // Count by domain
  const r2Count = await images.countDocuments({ url: { $regex: 'r2\\.serika\\.art' } });
  const cdnCount = await images.countDocuments({ url: { $regex: 'cdn\\.serika\\.art' } });
  const cdnEuCount = await images.countDocuments({ url: { $regex: 'cdn-eu\\.serika\\.art' } });
  
  console.log('\nImage URL distribution:');
  console.log(`  r2.serika.art:     ${r2Count}`);
  console.log(`  cdn.serika.art:    ${cdnCount}`);
  console.log(`  cdn-eu.serika.art: ${cdnEuCount}`);
  
  // Get a few sample URLs
  console.log('\nFirst 5 image URLs:');
  const samples = await images.find({}, { projection: { url: 1 }, limit: 5 }).toArray();
  samples.forEach((img, i) => {
    console.log(`  ${i + 1}. ${img.url}`);
  });
  
  await mongoClient.close();
}

main().catch(console.error);
