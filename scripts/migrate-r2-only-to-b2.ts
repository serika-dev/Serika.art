import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { MongoClient } from 'mongodb';
import https from 'https';
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

// Cloudflare R2 configuration (source)
const r2AccountId = process.env.R2_ACCOUNT_ID!;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID!;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
const r2BucketName = process.env.R2_BUCKET_NAME!;
const r2CustomDomain = process.env.R2_CUSTOM_DOMAIN!;

// Backblaze B2 configuration (destination)
const b2KeyId = process.env.B2_KEY_ID!;
const b2ApplicationKey = process.env.B2_APPLICATION_KEY!;
const b2BucketName = process.env.B2_BUCKET_NAME!;
const b2Endpoint = process.env.B2_ENDPOINT!;
const b2CustomDomain = process.env.B2_CUSTOM_DOMAIN!;

// MongoDB configuration
const mongoUri = process.env.MONGO_URI!;
const mongoDbName = process.env.MONGO_DB || 'serika-art';

// Validate configuration
if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
  console.error('❌ R2 configuration is incomplete. Check your .env.local file.');
  process.exit(1);
}

if (!b2KeyId || !b2ApplicationKey || !b2BucketName || !b2Endpoint) {
  console.error('❌ Backblaze B2 configuration is incomplete. Check your .env.local file.');
  process.exit(1);
}

if (!mongoUri) {
  console.error('❌ MongoDB configuration is incomplete. Check your .env.local file.');
  process.exit(1);
}

// Create HTTPS agents with high concurrency
const r2HttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
});

const b2HttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
});

// R2 Client (source)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
  forcePathStyle: false,
  requestHandler: new NodeHttpHandler({
    httpsAgent: r2HttpsAgent,
    connectionTimeout: 30000,
    requestTimeout: 300000,
  }),
});

// B2 Client (destination)
const b2Region = b2Endpoint.replace('s3.', '').replace('.backblazeb2.com', '');
const b2Client = new S3Client({
  region: b2Region,
  endpoint: `https://${b2Endpoint}`,
  credentials: {
    accessKeyId: b2KeyId,
    secretAccessKey: b2ApplicationKey,
  },
  forcePathStyle: true,
  requestHandler: new NodeHttpHandler({
    httpsAgent: b2HttpsAgent,
    connectionTimeout: 30000,
    requestTimeout: 300000,
  }),
});

// Statistics
let totalR2Urls = 0;
let checkedUrls = 0;
let alreadyInB2 = 0;
let migratedToB2 = 0;
let migrationErrors = 0;
let updatedInDb = 0;

// Extract key from URL
function extractKeyFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    let key = parsedUrl.pathname.startsWith('/') ? parsedUrl.pathname.slice(1) : parsedUrl.pathname;
    return key || null;
  } catch {
    return null;
  }
}

// Check if file exists in B2
async function existsInB2(key: string): Promise<boolean> {
  try {
    await b2Client.send(new HeadObjectCommand({
      Bucket: b2BucketName,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

// Copy file from R2 to B2
async function copyR2ToB2(key: string): Promise<boolean> {
  try {
    // Get from R2
    const getResponse = await r2Client.send(new GetObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    }));

    if (!getResponse.Body) {
      console.error(`\n  ❌ No body in R2 response for ${key}`);
      return false;
    }

    // Stream to B2
    await b2Client.send(new PutObjectCommand({
      Bucket: b2BucketName,
      Key: key,
      Body: getResponse.Body,
      ContentType: getResponse.ContentType,
      ContentLength: getResponse.ContentLength,
    }));

    return true;
  } catch (err: any) {
    console.error(`\n  ❌ Failed to copy ${key}: ${err.message}`);
    return false;
  }
}

// Process a single URL - check if R2, migrate if needed
async function processUrl(
  url: string,
  collection: string,
  docId: string,
  field: string,
  db: any
): Promise<{ migrated: boolean; newUrl: string | null }> {
  // Only process R2 URLs
  if (!url.includes(r2CustomDomain)) {
    return { migrated: false, newUrl: null };
  }

  totalR2Urls++;
  checkedUrls++;

  const key = extractKeyFromUrl(url);
  if (!key) {
    console.error(`\n  ❌ Could not extract key from URL: ${url}`);
    return { migrated: false, newUrl: null };
  }

  // Check if already in B2
  const inB2 = await existsInB2(key);
  
  if (inB2) {
    alreadyInB2++;
  } else {
    // Copy from R2 to B2
    const success = await copyR2ToB2(key);
    if (success) {
      migratedToB2++;
    } else {
      migrationErrors++;
      return { migrated: false, newUrl: null };
    }
  }

  // Update URL from R2 to B2/CDN
  const newUrl = url.replace(`https://${r2CustomDomain}`, `https://${b2CustomDomain}`);
  
  // Update in database
  try {
    await db.collection(collection).updateOne(
      { _id: docId },
      { $set: { [field]: newUrl } }
    );
    updatedInDb++;
  } catch (err: any) {
    console.error(`\n  ❌ Failed to update DB for ${collection}.${field}: ${err.message}`);
  }

  process.stdout.write(`\r🔄 Checked: ${checkedUrls} | Already in B2: ${alreadyInB2} | Migrated: ${migratedToB2} | Errors: ${migrationErrors} | DB Updated: ${updatedInDb}    `);

  return { migrated: true, newUrl };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

  console.log('🔄 Migrate R2-only URLs to B2');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No files will be migrated or DB updated\n');
  }

  console.log(`📊 Configuration:`);
  console.log(`   R2 Domain: ${r2CustomDomain}`);
  console.log(`   B2 Domain: ${b2CustomDomain}`);
  if (limit > 0) {
    console.log(`   Limit: ${limit} URLs`);
  }
  console.log('');

  // Connect to MongoDB
  console.log('📦 Connecting to MongoDB...');
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db(mongoDbName);
  console.log('✅ Connected to MongoDB\n');

  // Find all R2 URLs in the database
  console.log('📋 Scanning database for R2 URLs...\n');

  // Check images collection
  const r2ImageUrlCount = await db.collection('images').countDocuments({ 
    url: { $regex: r2CustomDomain } 
  });
  const r2ThumbnailCount = await db.collection('images').countDocuments({ 
    thumbnailUrl: { $regex: r2CustomDomain } 
  });
  console.log(`   📸 Images with R2 URLs: ${r2ImageUrlCount}`);
  console.log(`   🖼️  Thumbnails with R2 URLs: ${r2ThumbnailCount}`);

  // Check artists collection
  const r2ArtistAvatarCount = await db.collection('artists').countDocuments({ 
    avatarUrl: { $regex: r2CustomDomain } 
  });
  const r2ArtistBannerCount = await db.collection('artists').countDocuments({ 
    bannerUrl: { $regex: r2CustomDomain } 
  });
  console.log(`   🎨 Artist avatars with R2 URLs: ${r2ArtistAvatarCount}`);
  console.log(`   🎨 Artist banners with R2 URLs: ${r2ArtistBannerCount}`);

  // Check users collection
  const r2UserAvatarCount = await db.collection('users').countDocuments({ 
    avatarUrl: { $regex: r2CustomDomain } 
  });
  console.log(`   👤 User avatars with R2 URLs: ${r2UserAvatarCount}`);

  const totalToMigrate = r2ImageUrlCount + r2ThumbnailCount + r2ArtistAvatarCount + r2ArtistBannerCount + r2UserAvatarCount;
  console.log(`\n   📊 Total R2 URLs to migrate: ${totalToMigrate}\n`);

  if (totalToMigrate === 0) {
    console.log('✅ No R2 URLs found in database. Nothing to migrate!');
    await mongoClient.close();
    return;
  }

  if (dryRun) {
    console.log('🔍 Dry run complete. Use without --dry-run to actually migrate.\n');
    await mongoClient.close();
    return;
  }

  // Process images
  console.log('🔄 Migrating R2 URLs to B2...\n');
  const startTime = Date.now();

  // Process image URLs
  if (r2ImageUrlCount > 0 || r2ThumbnailCount > 0) {
    const query = {
      $or: [
        { url: { $regex: r2CustomDomain } },
        { thumbnailUrl: { $regex: r2CustomDomain } }
      ]
    };
    
    const cursor = db.collection('images').find(query);
    let processed = 0;
    
    for await (const doc of cursor) {
      if (limit > 0 && processed >= limit) break;
      
      if (doc.url && doc.url.includes(r2CustomDomain)) {
        await processUrl(doc.url, 'images', doc._id, 'url', db);
        processed++;
      }
      
      if (limit > 0 && processed >= limit) break;
      
      if (doc.thumbnailUrl && doc.thumbnailUrl.includes(r2CustomDomain)) {
        await processUrl(doc.thumbnailUrl, 'images', doc._id, 'thumbnailUrl', db);
        processed++;
      }
    }
  }

  // Process artist URLs
  if (r2ArtistAvatarCount > 0 || r2ArtistBannerCount > 0) {
    const query = {
      $or: [
        { avatarUrl: { $regex: r2CustomDomain } },
        { bannerUrl: { $regex: r2CustomDomain } }
      ]
    };
    
    const cursor = db.collection('artists').find(query);
    
    for await (const doc of cursor) {
      if (doc.avatarUrl && doc.avatarUrl.includes(r2CustomDomain)) {
        await processUrl(doc.avatarUrl, 'artists', doc._id, 'avatarUrl', db);
      }
      if (doc.bannerUrl && doc.bannerUrl.includes(r2CustomDomain)) {
        await processUrl(doc.bannerUrl, 'artists', doc._id, 'bannerUrl', db);
      }
    }
  }

  // Process user URLs
  if (r2UserAvatarCount > 0) {
    const cursor = db.collection('users').find({ avatarUrl: { $regex: r2CustomDomain } });
    
    for await (const doc of cursor) {
      if (doc.avatarUrl && doc.avatarUrl.includes(r2CustomDomain)) {
        await processUrl(doc.avatarUrl, 'users', doc._id, 'avatarUrl', db);
      }
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;

  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 Migration Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Total R2 URLs found: ${totalR2Urls}`);
  console.log(`   Already in B2: ${alreadyInB2}`);
  console.log(`   Newly migrated to B2: ${migratedToB2}`);
  console.log(`   Migration errors: ${migrationErrors}`);
  console.log(`   Database URLs updated: ${updatedInDb}`);
  console.log('');
  console.log(`   ⏱️ Time elapsed: ${elapsed.toFixed(1)} seconds`);
  if (checkedUrls > 0) {
    console.log(`   📈 Rate: ${(checkedUrls / elapsed).toFixed(1)} URLs/sec`);
  }

  await mongoClient.close();
  console.log('\n✅ Done!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
