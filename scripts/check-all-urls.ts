import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
const content = fs.readFileSync(envPath, 'utf-8');
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) process.env[key] = valueParts.join('=');
  }
}

async function main() {
  const client = new MongoClient(process.env.MONGO_URI!);
  await client.connect();
  const db = client.db(process.env.MONGO_DB || 'serika-art');
  
  // Check users with avatarUrl
  const users = await db.collection('users').find({ avatarUrl: { $exists: true, $ne: null } }).toArray();
  console.log('=== USERS WITH AVATARS ===');
  console.log('Count:', users.length);
  users.slice(0, 10).forEach(u => console.log(' -', u.username, ':', u.avatarUrl));
  
  // Check artists with avatarUrl or bannerUrl
  const artists = await db.collection('artists').find({ 
    $or: [
      { avatarUrl: { $exists: true, $ne: null } },
      { bannerUrl: { $exists: true, $ne: null } }
    ]
  }).toArray();
  console.log('\n=== ARTISTS WITH AVATARS/BANNERS ===');
  console.log('Count:', artists.length);
  artists.forEach(a => {
    console.log(' -', a.tagName);
    if (a.avatarUrl) console.log('   avatar:', a.avatarUrl);
    if (a.bannerUrl) console.log('   banner:', a.bannerUrl);
  });
  
  // Check artist claims for verification
  const claims = await db.collection('artistClaims').find({}).toArray();
  console.log('\n=== ARTIST CLAIMS ===');
  console.log('Count:', claims.length);
  
  // Check DMCA requests for any file URLs
  const dmcas = await db.collection('dmcaRequests').find({}).toArray();
  console.log('\n=== DMCA REQUESTS ===');
  console.log('Count:', dmcas.length);
  
  // Check for any collections with file uploads
  const collections = await db.listCollections().toArray();
  console.log('\n=== ALL COLLECTIONS ===');
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(' -', c.name, ':', count, 'documents');
  }
  
  // Check sample of image URLs
  const images = await db.collection('images').find({}).limit(5).toArray();
  console.log('\n=== SAMPLE IMAGE URLS ===');
  images.forEach(img => {
    console.log(' - ID:', img.sequentialId);
    console.log('   url:', img.url);
    console.log('   thumbnailUrl:', img.thumbnailUrl);
  });
  
  // Count images by URL domain
  console.log('\n=== URL DOMAIN ANALYSIS ===');
  const r2Count = await db.collection('images').countDocuments({ url: { $regex: /r2\.serika\.art/ } });
  const cdnCount = await db.collection('images').countDocuments({ url: { $regex: /cdn\.serika\.art/ } });
  const otherCount = await db.collection('images').countDocuments({ 
    url: { $exists: true },
    $and: [
      { url: { $not: { $regex: /r2\.serika\.art/ } } },
      { url: { $not: { $regex: /cdn\.serika\.art/ } } }
    ]
  });
  console.log(' - r2.serika.art:', r2Count);
  console.log(' - cdn.serika.art:', cdnCount);
  console.log(' - other:', otherCount);
  
  // User avatars by domain
  console.log('\n=== USER AVATAR DOMAIN ANALYSIS ===');
  const userR2 = await db.collection('users').countDocuments({ avatarUrl: { $regex: /r2\.serika\.art/ } });
  const userCdn = await db.collection('users').countDocuments({ avatarUrl: { $regex: /cdn\.serika\.art/ } });
  console.log(' - r2.serika.art:', userR2);
  console.log(' - cdn.serika.art:', userCdn);
  
  // Artist avatars/banners by domain
  console.log('\n=== ARTIST AVATAR/BANNER DOMAIN ANALYSIS ===');
  const artistAvatarR2 = await db.collection('artists').countDocuments({ avatarUrl: { $regex: /r2\.serika\.art/ } });
  const artistAvatarCdn = await db.collection('artists').countDocuments({ avatarUrl: { $regex: /cdn\.serika\.art/ } });
  const artistBannerR2 = await db.collection('artists').countDocuments({ bannerUrl: { $regex: /r2\.serika\.art/ } });
  const artistBannerCdn = await db.collection('artists').countDocuments({ bannerUrl: { $regex: /cdn\.serika\.art/ } });
  console.log(' - avatarUrl r2.serika.art:', artistAvatarR2);
  console.log(' - avatarUrl cdn.serika.art:', artistAvatarCdn);
  console.log(' - bannerUrl r2.serika.art:', artistBannerR2);
  console.log(' - bannerUrl cdn.serika.art:', artistBannerCdn);
  
  await client.close();
}

main().catch(console.error);
