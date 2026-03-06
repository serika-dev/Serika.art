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

// Backblaze B2 configuration (destination)
const b2KeyId = process.env.B2_KEY_ID!;
const b2ApplicationKey = process.env.B2_APPLICATION_KEY!;
const b2BucketName = process.env.B2_BUCKET_NAME!;
const b2Endpoint = process.env.B2_ENDPOINT!;
const b2CustomDomain = process.env.B2_CUSTOM_DOMAIN;

// MongoDB configuration
const mongoUri = process.env.MONGO_URI!;
const mongoDbName = process.env.MONGO_DB || 'serika-art';

// Old R2 custom domain for URL replacement
const r2CustomDomain = process.env.R2_CUSTOM_DOMAIN!;

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

// Determine new base URL
const newBaseUrl = b2CustomDomain ? `https://${b2CustomDomain}` : `https://${b2BucketName}.${b2Endpoint}`;
const oldBaseUrl = r2CustomDomain ? `https://${r2CustomDomain}` : `https://${r2BucketName}.${r2AccountId}.r2.cloudflarestorage.com`;

// Create HTTPS agents with high concurrency
const r2HttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 150,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
});

const b2HttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 150,
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
  forcePathStyle: false,
  requestHandler: new NodeHttpHandler({
    httpsAgent: b2HttpsAgent,
    connectionTimeout: 30000,
    requestTimeout: 300000,
  }),
});

interface ObjectInfo {
  Key: string;
  Size: number;
}

interface Stats {
  r2Count: number;
  b2Count: number;
  missing: number;
  sizeMismatch: number;
  uploaded: number;
  failed: number;
  totalBytes: number;
}

const stats: Stats = {
  r2Count: 0,
  b2Count: 0,
  missing: 0,
  sizeMismatch: 0,
  uploaded: 0,
  failed: 0,
  totalBytes: 0,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// List all objects from R2
async function listAllR2Objects(): Promise<Map<string, number>> {
  const objects = new Map<string, number>();
  let continuationToken: string | undefined;
  let count = 0;

  console.log('📋 Listing all objects in R2 bucket...');
  const startTime = Date.now();

  do {
    const command = new ListObjectsV2Command({
      Bucket: r2BucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await r2Client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Size !== undefined) {
          objects.set(obj.Key, obj.Size);
          count++;
        }
      }
    }

    continuationToken = response.NextContinuationToken;
    process.stdout.write(`\r   Found ${count.toLocaleString()} objects in R2...`);
  } while (continuationToken);

  const elapsed = Date.now() - startTime;
  console.log(`\n   ✅ Listed ${count.toLocaleString()} R2 objects in ${formatTime(elapsed)}\n`);
  return objects;
}

// List all objects from B2
async function listAllB2Objects(): Promise<Map<string, number>> {
  const objects = new Map<string, number>();
  let continuationToken: string | undefined;
  let count = 0;

  console.log('📋 Listing all objects in B2 bucket...');
  const startTime = Date.now();

  do {
    const command = new ListObjectsV2Command({
      Bucket: b2BucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await b2Client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Size !== undefined) {
          objects.set(obj.Key, obj.Size);
          count++;
        }
      }
    }

    continuationToken = response.NextContinuationToken;
    process.stdout.write(`\r   Found ${count.toLocaleString()} objects in B2...`);
  } while (continuationToken);

  const elapsed = Date.now() - startTime;
  console.log(`\n   ✅ Listed ${count.toLocaleString()} B2 objects in ${formatTime(elapsed)}\n`);
  return objects;
}

// Upload a single object from R2 to B2
async function uploadObject(key: string, expectedSize: number): Promise<boolean> {
  try {
    // Get object from R2
    const getCommand = new GetObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    });

    const response = await r2Client.send(getCommand);

    if (!response.Body) {
      return false;
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Verify size matches
    if (buffer.length !== expectedSize) {
      console.error(`\n⚠️  Size mismatch for ${key}: expected ${expectedSize}, got ${buffer.length}`);
    }

    // Upload to B2
    const putCommand = new PutObjectCommand({
      Bucket: b2BucketName,
      Key: key,
      Body: buffer,
      ContentType: response.ContentType || 'application/octet-stream',
      CacheControl: response.CacheControl || 'public, max-age=31536000',
    });

    await b2Client.send(putCommand);
    stats.totalBytes += buffer.length;
    return true;
  } catch (error: any) {
    return false;
  }
}

async function main() {
  const startTime = Date.now();
  const CONCURRENCY = 75; // High concurrency for fast uploads
  const SCAN_ONLY = process.argv.includes('--scan-only');
  const DB_ONLY = process.argv.includes('--db-only');

  console.log('🔍 Verify and Sync: R2 → B2\n');
  console.log('='.repeat(60));
  console.log(`Source (R2):      ${r2BucketName}`);
  console.log(`Destination (B2): ${b2BucketName}`);
  console.log(`Concurrency:      ${CONCURRENCY}`);
  console.log(`Scan Only:        ${SCAN_ONLY}`);
  console.log(`DB Only:          ${DB_ONLY}`);
  console.log('='.repeat(60) + '\n');

  if (DB_ONLY) {
    // Skip file operations, just update DB
    console.log('📊 Skipping file verification, updating database only...\n');
  } else {
    // Step 1: List all objects from both buckets
    console.log('📊 Step 1: Scanning both buckets...\n');
    
    const [r2Objects, b2Objects] = await Promise.all([
      listAllR2Objects(),
      listAllB2Objects(),
    ]);

    stats.r2Count = r2Objects.size;
    stats.b2Count = b2Objects.size;

    // Step 2: Find differences
    console.log('📊 Step 2: Comparing objects...\n');
    
    const toUpload: ObjectInfo[] = [];

    for (const [key, r2Size] of r2Objects) {
      const b2Size = b2Objects.get(key);
      
      if (b2Size === undefined) {
        // Missing in B2
        stats.missing++;
        toUpload.push({ Key: key, Size: r2Size });
      } else if (b2Size !== r2Size) {
        // Size mismatch - needs re-upload
        stats.sizeMismatch++;
        toUpload.push({ Key: key, Size: r2Size });
      }
    }

    console.log('📊 Comparison Results:');
    console.log('='.repeat(60));
    console.log(`R2 objects:        ${stats.r2Count.toLocaleString()}`);
    console.log(`B2 objects:        ${stats.b2Count.toLocaleString()}`);
    console.log(`Missing in B2:     ${stats.missing.toLocaleString()}`);
    console.log(`Size mismatch:     ${stats.sizeMismatch.toLocaleString()}`);
    console.log(`Total to upload:   ${toUpload.length.toLocaleString()}`);
    console.log('='.repeat(60) + '\n');

    if (SCAN_ONLY) {
      console.log('📝 Scan-only mode, no uploads will be performed.\n');
      
      // Show some sample missing files
      if (toUpload.length > 0) {
        console.log('📋 Sample files to upload:');
        for (let i = 0; i < Math.min(20, toUpload.length); i++) {
          const item = toUpload[i];
          console.log(`   ${item.Key} (${formatBytes(item.Size)})`);
        }
        if (toUpload.length > 20) {
          console.log(`   ... and ${toUpload.length - 20} more`);
        }
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Total time: ${formatTime(elapsed)}`);
      return;
    }

    // Step 3: Upload missing/mismatched files
    if (toUpload.length > 0) {
      console.log(`📤 Step 3: Uploading ${toUpload.length.toLocaleString()} files...\n`);
      
      let completed = 0;
      let activeWorkers = 0;
      let lastProgressUpdate = Date.now();
      const uploadStart = Date.now();
      
      // Queue-based worker system
      const queue = [...toUpload];
      
      async function worker() {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;
          
          activeWorkers++;
          const success = await uploadObject(item.Key, item.Size);
          
          if (success) {
            stats.uploaded++;
          } else {
            stats.failed++;
          }
          
          completed++;
          activeWorkers--;
          
          // Progress update
          const now = Date.now();
          if (now - lastProgressUpdate > 500) {
            lastProgressUpdate = now;
            const elapsed = now - uploadStart;
            const rate = completed / (elapsed / 1000);
            const remaining = queue.length;
            const eta = remaining / rate;
            process.stdout.write(`\r📤 Progress: ${completed.toLocaleString()}/${toUpload.length.toLocaleString()} | ✅ ${stats.uploaded.toLocaleString()} | ❌ ${stats.failed.toLocaleString()} | ⚡ ${rate.toFixed(0)}/s | ETA: ${formatTime(eta * 1000)}     `);
          }
        }
      }
      
      // Start workers
      const workers = Array(CONCURRENCY).fill(null).map(() => worker());
      await Promise.all(workers);
      
      const uploadElapsed = Date.now() - uploadStart;
      console.log(`\n\n✅ Upload complete in ${formatTime(uploadElapsed)}`);
      console.log(`   Uploaded: ${stats.uploaded.toLocaleString()}`);
      console.log(`   Failed:   ${stats.failed.toLocaleString()}`);
      console.log(`   Data:     ${formatBytes(stats.totalBytes)}\n`);
    } else {
      console.log('✅ All files are already synced!\n');
    }
  }

  // Step 4: Update database
  console.log('🔄 Step 4: Updating database URLs...\n');
  console.log(`   Old URL: ${oldBaseUrl}`);
  console.log(`   New URL: ${newBaseUrl}\n`);

  try {
    const mongoClient = await MongoClient.connect(mongoUri);
    const db = mongoClient.db(mongoDbName);
    
    // Update images collection
    const images = db.collection('images');
    const imagesUrlResult = await images.updateMany(
      { url: { $regex: oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      [{ $set: { url: { $replaceOne: { input: '$url', find: oldBaseUrl, replacement: newBaseUrl } } } }]
    );
    console.log(`   ✅ Updated ${imagesUrlResult.modifiedCount.toLocaleString()} image URLs`);
    
    const imagesThumbnailResult = await images.updateMany(
      { thumbnailUrl: { $regex: oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      [{ $set: { thumbnailUrl: { $replaceOne: { input: '$thumbnailUrl', find: oldBaseUrl, replacement: newBaseUrl } } } }]
    );
    console.log(`   ✅ Updated ${imagesThumbnailResult.modifiedCount.toLocaleString()} thumbnail URLs`);
    
    // Update artists collection
    const artists = db.collection('artists');
    const artistsAvatarResult = await artists.updateMany(
      { avatarUrl: { $regex: oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      [{ $set: { avatarUrl: { $replaceOne: { input: '$avatarUrl', find: oldBaseUrl, replacement: newBaseUrl } } } }]
    );
    console.log(`   ✅ Updated ${artistsAvatarResult.modifiedCount.toLocaleString()} artist avatars`);
    
    const artistsBannerResult = await artists.updateMany(
      { bannerUrl: { $regex: oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      [{ $set: { bannerUrl: { $replaceOne: { input: '$bannerUrl', find: oldBaseUrl, replacement: newBaseUrl } } } }]
    );
    console.log(`   ✅ Updated ${artistsBannerResult.modifiedCount.toLocaleString()} artist banners`);
    
    // Update users collection
    const users = db.collection('users');
    const usersAvatarResult = await users.updateMany(
      { avatarUrl: { $regex: oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      [{ $set: { avatarUrl: { $replaceOne: { input: '$avatarUrl', find: oldBaseUrl, replacement: newBaseUrl } } } }]
    );
    console.log(`   ✅ Updated ${usersAvatarResult.modifiedCount.toLocaleString()} user avatars`);
    
    const totalDbUpdates = imagesUrlResult.modifiedCount + imagesThumbnailResult.modifiedCount + 
                           artistsAvatarResult.modifiedCount + artistsBannerResult.modifiedCount + 
                           usersAvatarResult.modifiedCount;
    
    console.log(`\n   💾 Total DB records updated: ${totalDbUpdates.toLocaleString()}`);
    
    await mongoClient.close();
  } catch (error: any) {
    console.error('❌ Database update failed:', error.message);
  }

  // Final summary
  const totalTime = Date.now() - startTime;
  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Summary');
  console.log('='.repeat(60));
  console.log(`Total time:        ${formatTime(totalTime)}`);
  if (!DB_ONLY) {
    console.log(`R2 objects:        ${stats.r2Count.toLocaleString()}`);
    console.log(`B2 objects:        ${stats.b2Count.toLocaleString()}`);
    console.log(`Missing found:     ${stats.missing.toLocaleString()}`);
    console.log(`Size mismatches:   ${stats.sizeMismatch.toLocaleString()}`);
    console.log(`Uploaded:          ${stats.uploaded.toLocaleString()}`);
    console.log(`Failed:            ${stats.failed.toLocaleString()}`);
    console.log(`Data transferred:  ${formatBytes(stats.totalBytes)}`);
  }
  console.log('='.repeat(60));
  
  if (stats.failed > 0) {
    console.log('\n⚠️  Some uploads failed. Run again to retry.');
  } else {
    console.log('\n✅ All operations completed successfully!');
  }
}

main();
