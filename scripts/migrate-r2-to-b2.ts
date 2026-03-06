import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
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
  console.error('Required: B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT');
  process.exit(1);
}

if (!mongoUri) {
  console.error('❌ MongoDB configuration is incomplete. Check your .env.local file.');
  console.error('Required: MONGO_URI');
  process.exit(1);
}

console.log(`📦 Using database: ${mongoDbName}`);

// Determine new base URL
const newBaseUrl = b2CustomDomain ? `https://${b2CustomDomain}` : `https://${b2BucketName}.${b2Endpoint}`;
const oldBaseUrl = r2CustomDomain ? `https://${r2CustomDomain}` : `https://${r2BucketName}.${r2AccountId}.r2.cloudflarestorage.com`;

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
  forcePathStyle: false,
  requestHandler: new NodeHttpHandler({
    httpsAgent: b2HttpsAgent,
    connectionTimeout: 30000,
    requestTimeout: 300000,
  }),
});

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  totalBytes: number;
  dbUpdates: number;
}

const stats: MigrationStats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  failed: 0,
  totalBytes: 0,
  dbUpdates: 0,
};

// Check if object already exists in B2
async function objectExistsInB2(key: string): Promise<boolean> {
  try {
    await b2Client.send(new HeadObjectCommand({ Bucket: b2BucketName, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function listAllObjects(): Promise<{ Key: string; Size: number; ContentType?: string }[]> {
  const objects: { Key: string; Size: number; ContentType?: string }[] = [];
  let continuationToken: string | undefined;

  console.log('📋 Listing all objects in R2 bucket...');

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
          objects.push({
            Key: obj.Key,
            Size: obj.Size,
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
    console.log(`  Found ${objects.length} objects so far...`);
  } while (continuationToken);

  return objects;
}

async function migrateObject(key: string, size: number, skipExistingCheck = false): Promise<'migrated' | 'skipped' | 'failed'> {
  try {
    // Skip if already exists in B2 (unless we're skipping the check)
    if (!skipExistingCheck && await objectExistsInB2(key)) {
      return 'skipped';
    }

    // Get object from R2
    const getCommand = new GetObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    });

    const response = await r2Client.send(getCommand);

    if (!response.Body) {
      return 'failed';
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Upload to B2
    const putCommand = new PutObjectCommand({
      Bucket: b2BucketName,
      Key: key,
      Body: buffer,
      ContentType: response.ContentType || 'application/octet-stream',
      CacheControl: response.CacheControl || 'public, max-age=31536000',
    });

    await b2Client.send(putCommand);

    stats.totalBytes += size;
    return 'migrated';
  } catch (error: any) {
    return 'failed';
  }
}

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

// Clear all objects from B2 bucket
async function clearB2Bucket(): Promise<number> {
  console.log('🗑️  Clearing B2 bucket...\n');
  let deletedCount = 0;
  let continuationToken: string | undefined;
  
  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: b2BucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });
    
    const response = await b2Client.send(listCommand);
    
    if (response.Contents && response.Contents.length > 0) {
      const objectsToDelete = response.Contents
        .filter(obj => obj.Key)
        .map(obj => ({ Key: obj.Key! }));
      
      if (objectsToDelete.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: b2BucketName,
          Delete: { Objects: objectsToDelete },
        });
        
        await b2Client.send(deleteCommand);
        deletedCount += objectsToDelete.length;
        process.stdout.write(`\r🗑️  Deleted ${deletedCount} objects...`);
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  console.log(`\n✅ Cleared ${deletedCount} objects from B2 bucket\n`);
  return deletedCount;
}

// Process objects with a concurrency limit
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      const result = await processor(items[currentIndex]);
      results[currentIndex] = result;
      completed++;
      if (onProgress) onProgress(completed, items.length);
    }
  }

  const workers = Array(Math.min(concurrency, items.length)).fill(null).map(() => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const startTime = Date.now();
  const CONCURRENCY = 50; // Higher concurrency since no DB per-file
  const RESTART = process.argv.includes('--restart');
  
  console.log('🚀 Starting FAST migration from Cloudflare R2 to Backblaze B2\n');
  console.log(`⚡ Concurrency: ${CONCURRENCY} parallel transfers`);
  if (RESTART) {
    console.log('🔄 RESTART mode: Will clear B2 bucket first');
  }
  console.log('');
  console.log('Source (R2):');
  console.log(`  Account ID: ${r2AccountId}`);
  console.log(`  Bucket: ${r2BucketName}`);
  console.log('\nDestination (B2):');
  console.log(`  Endpoint: ${b2Endpoint}`);
  console.log(`  Bucket: ${b2BucketName}`);
  console.log(`\nDatabase: ${mongoDbName}`);
  console.log('');

  try {
    // Clear B2 bucket if --restart flag is provided
    if (RESTART) {
      await clearB2Bucket();
    }
    
    // Stream migration - start migrating while still listing
    console.log('📋 Listing and migrating objects simultaneously...\n');
    
    let continuationToken: string | undefined;
    let totalListed = 0;
    let lastProgressUpdate = Date.now();
    const progressInterval = 1000; // Update every second
    
    // Queue for objects to migrate
    const queue: { Key: string; Size: number }[] = [];
    let listingComplete = false;
    let activeWorkers = 0;
    const maxQueueSize = 500; // Smaller buffer to reduce memory
    
    // Worker function
    async function worker() {
      while (true) {
        // Get next item from queue
        const item = queue.shift();
        if (!item) {
          if (listingComplete) break;
          // Wait a bit for more items
          await new Promise(r => setTimeout(r, 10));
          continue;
        }
        
        activeWorkers++;
        const result = await migrateObject(item.Key, item.Size, true);
        if (result === 'migrated') stats.migrated++;
        else if (result === 'skipped') stats.skipped++;
        else stats.failed++;
        activeWorkers--;
        
        // Progress update
        const now = Date.now();
        if (now - lastProgressUpdate > progressInterval) {
          lastProgressUpdate = now;
          const elapsed = now - startTime;
          const completed = stats.migrated + stats.skipped + stats.failed;
          const rate = completed / (elapsed / 1000);
          process.stdout.write(`\r📊 Listed: ${totalListed} | Done: ${completed} | ✅ ${stats.migrated} | ❌ ${stats.failed} | 🔄 ${activeWorkers} active | ⚡ ${rate.toFixed(0)}/s    `);
        }
      }
    }
    
    // Start workers
    const workers = Array(CONCURRENCY).fill(null).map(() => worker());
    
    // List objects and add to queue
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
            // Wait if queue is too full
            while (queue.length >= maxQueueSize) {
              await new Promise(r => setTimeout(r, 50));
            }
            queue.push({ Key: obj.Key, Size: obj.Size });
            totalListed++;
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    stats.total = totalListed;
    listingComplete = true;
    
    console.log(`\n📦 Listed all ${totalListed} objects, waiting for transfers to complete...\n`);
    
    // Wait for all workers to finish
    await Promise.all(workers);

    const totalTime = Date.now() - startTime;

    // Print file migration summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 File Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total objects:     ${stats.total}`);
    console.log(`Migrated:          ${stats.migrated}`);
    console.log(`Skipped (exists):  ${stats.skipped}`);
    console.log(`Failed:            ${stats.failed}`);
    console.log(`Total data moved:  ${formatBytes(stats.totalBytes)}`);
    console.log(`Time elapsed:      ${formatTime(totalTime)}`);
    console.log(`Speed:             ${(stats.total / (totalTime / 1000)).toFixed(1)} files/sec`);
    console.log('='.repeat(60));

    // Now do bulk DB update
    console.log('\n🔄 Updating database URLs in bulk...\n');
    console.log(`Old base URL: ${oldBaseUrl}`);
    console.log(`New base URL: ${newBaseUrl}\n`);
    
    const mongoClient = await MongoClient.connect(mongoUri);
    const db = mongoClient.db(mongoDbName);
    
    // Update images collection - use regex replacement for all URLs at once
    const images = db.collection('images');
    const imagesUrlResult = await images.updateMany(
      { url: { $regex: oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      [{ $set: { url: { $replaceOne: { input: '$url', find: oldBaseUrl, replacement: newBaseUrl } } } }]
    );
    console.log(`✅ Updated ${imagesUrlResult.modifiedCount} image URLs`);
    
    const imagesThumbnailResult = await images.updateMany(
      { thumbnailUrl: { $regex: oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      [{ $set: { thumbnailUrl: { $replaceOne: { input: '$thumbnailUrl', find: oldBaseUrl, replacement: newBaseUrl } } } }]
    );
    console.log(`✅ Updated ${imagesThumbnailResult.modifiedCount} image thumbnail URLs`);
    
    // Update artists collection
    const artists = db.collection('artists');
    const artistsAvatarResult = await artists.updateMany(
      { avatarUrl: { $regex: oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      [{ $set: { avatarUrl: { $replaceOne: { input: '$avatarUrl', find: oldBaseUrl, replacement: newBaseUrl } } } }]
    );
    console.log(`✅ Updated ${artistsAvatarResult.modifiedCount} artist avatar URLs`);
    
    const artistsBannerResult = await artists.updateMany(
      { bannerUrl: { $regex: oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      [{ $set: { bannerUrl: { $replaceOne: { input: '$bannerUrl', find: oldBaseUrl, replacement: newBaseUrl } } } }]
    );
    console.log(`✅ Updated ${artistsBannerResult.modifiedCount} artist banner URLs`);
    
    // Update users collection (avatarUrl)
    const users = db.collection('users');
    const usersAvatarResult = await users.updateMany(
      { avatarUrl: { $regex: oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      [{ $set: { avatarUrl: { $replaceOne: { input: '$avatarUrl', find: oldBaseUrl, replacement: newBaseUrl } } } }]
    );
    console.log(`✅ Updated ${usersAvatarResult.modifiedCount} user avatar URLs`);
    
    const totalDbUpdates = imagesUrlResult.modifiedCount + imagesThumbnailResult.modifiedCount + 
                           artistsAvatarResult.modifiedCount + artistsBannerResult.modifiedCount + 
                           usersAvatarResult.modifiedCount;
    
    console.log(`\n💾 Total DB URLs updated: ${totalDbUpdates}`);
    
    await mongoClient.close();

    if (stats.failed > 0) {
      console.log('\n⚠️  Some objects failed to migrate.');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
  }
}

main();
