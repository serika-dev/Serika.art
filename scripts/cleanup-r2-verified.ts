import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { MongoClient } from 'mongodb';
import https from 'https';
import http from 'http';
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

// Cloudflare R2 configuration
const r2AccountId = process.env.R2_ACCOUNT_ID!;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID!;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
const r2BucketName = process.env.R2_BUCKET_NAME!;
const r2CustomDomain = process.env.R2_CUSTOM_DOMAIN!;

// B2 configuration (for URL checking)
const b2CustomDomain = process.env.B2_CUSTOM_DOMAIN!;

// MongoDB configuration
const mongoUri = process.env.MONGO_URI!;
const mongoDbName = process.env.MONGO_DB || 'serika-art';

// Validate configuration
if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
  console.error('❌ R2 configuration is incomplete. Check your .env.local file.');
  process.exit(1);
}

if (!mongoUri) {
  console.error('❌ MongoDB configuration is incomplete. Check your .env.local file.');
  process.exit(1);
}

// Create HTTPS agent for R2
const r2HttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
});

// R2 Client
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
    requestTimeout: 60000,
  }),
});

// Statistics
let totalUrls = 0;
let checkedUrls = 0;
let workingUrls = 0;
let brokenUrls = 0;
let deletedFromR2 = 0;
let deleteErrors = 0;
let skippedUrls = 0;

// Track broken URLs for reporting
const brokenUrlsList: { url: string; status: number | string; collection: string }[] = [];

// Check if a URL exists by making a HEAD request
async function checkUrlExists(url: string): Promise<{ exists: boolean; status: number | string }> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = protocol.request(
        url,
        {
          method: 'HEAD',
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; URLChecker/1.0)',
          },
        },
        (res) => {
          // 200-299 are success, also accept 304 (not modified)
          const exists = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400;
          resolve({ exists, status: res.statusCode || 'unknown' });
        }
      );

      req.on('error', (err) => {
        resolve({ exists: false, status: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ exists: false, status: 'timeout' });
      });

      req.end();
    } catch (err: any) {
      resolve({ exists: false, status: err.message || 'error' });
    }
  });
}

// Extract key from URL
function extractKeyFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    // Remove leading slash
    let key = parsedUrl.pathname.startsWith('/') ? parsedUrl.pathname.slice(1) : parsedUrl.pathname;
    return key || null;
  } catch {
    return null;
  }
}

// Delete a file from R2
async function deleteFromR2(key: string): Promise<boolean> {
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: r2BucketName,
        Key: key,
      })
    );
    return true;
  } catch (err: any) {
    console.error(`  ❌ Failed to delete ${key} from R2: ${err.message}`);
    return false;
  }
}

// Process a single URL
async function processUrl(
  url: string,
  collection: string,
  dryRun: boolean
): Promise<void> {
  checkedUrls++;

  // Skip empty or invalid URLs
  if (!url || typeof url !== 'string') {
    skippedUrls++;
    return;
  }

  // Check if URL works
  const { exists, status } = await checkUrlExists(url);

  if (exists) {
    workingUrls++;

    // Extract the key from the URL to delete from R2
    const key = extractKeyFromUrl(url);
    
    if (key) {
      if (dryRun) {
        // In dry run, just log what would be deleted
        process.stdout.write(`\r✅ Working URLs: ${workingUrls} | ❌ Broken: ${brokenUrls} | 🗑️ Would delete: ${deletedFromR2 + 1} | Checked: ${checkedUrls}/${totalUrls}    `);
        deletedFromR2++;
      } else {
        // Actually delete from R2
        const deleted = await deleteFromR2(key);
        if (deleted) {
          deletedFromR2++;
        } else {
          deleteErrors++;
        }
        process.stdout.write(`\r✅ Working: ${workingUrls} | ❌ Broken: ${brokenUrls} | 🗑️ Deleted: ${deletedFromR2} | ⚠️ Errors: ${deleteErrors} | Checked: ${checkedUrls}/${totalUrls}    `);
      }
    }
  } else {
    brokenUrls++;
    brokenUrlsList.push({ url, status, collection });
    process.stdout.write(`\r✅ Working: ${workingUrls} | ❌ Broken: ${brokenUrls} | 🗑️ Deleted: ${deletedFromR2} | Checked: ${checkedUrls}/${totalUrls}    `);
  }
}

// Process URLs with concurrency control
async function processUrlsWithConcurrency(
  urls: { url: string; collection: string }[],
  concurrency: number,
  dryRun: boolean
): Promise<void> {
  const queue = [...urls];
  const workers: Promise<void>[] = [];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) {
        await processUrl(item.url, item.collection, dryRun);
      }
    }
  }

  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--delete');
  const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '50');
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

  console.log('🔍 R2 Cleanup Script - Verify URLs and Delete from R2');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No files will be deleted');
    console.log('   Add --delete flag to actually delete files from R2\n');
  } else {
    console.log('⚠️  DELETE MODE - Files will be permanently deleted from R2!\n');
  }

  console.log(`📊 Configuration:`);
  console.log(`   R2 Bucket: ${r2BucketName}`);
  console.log(`   R2 Domain: ${r2CustomDomain}`);
  console.log(`   B2 Domain: ${b2CustomDomain}`);
  console.log(`   Concurrency: ${concurrency}`);
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

  // Collect all URLs from the database
  console.log('📋 Collecting URLs from database...');
  const allUrls: { url: string; collection: string }[] = [];

  // Get image URLs
  const images = db.collection('images');
  const imageCursor = images.find({}, { projection: { url: 1, thumbnailUrl: 1 } });
  let imageCount = 0;
  
  for await (const doc of imageCursor) {
    if (doc.url) {
      allUrls.push({ url: doc.url, collection: 'images.url' });
      imageCount++;
    }
    if (doc.thumbnailUrl) {
      allUrls.push({ url: doc.thumbnailUrl, collection: 'images.thumbnailUrl' });
    }
  }
  console.log(`   📸 Images: ${imageCount} documents (${allUrls.length} URLs so far)`);

  // Get artist URLs
  const artists = db.collection('artists');
  const artistCursor = artists.find({}, { projection: { avatarUrl: 1, bannerUrl: 1 } });
  let artistCount = 0;
  
  for await (const doc of artistCursor) {
    if (doc.avatarUrl) {
      allUrls.push({ url: doc.avatarUrl, collection: 'artists.avatarUrl' });
      artistCount++;
    }
    if (doc.bannerUrl) {
      allUrls.push({ url: doc.bannerUrl, collection: 'artists.bannerUrl' });
      artistCount++;
    }
  }
  console.log(`   🎨 Artists: ${artistCount} URLs`);

  // Get user avatar URLs
  const users = db.collection('users');
  const userCursor = users.find({}, { projection: { avatarUrl: 1 } });
  let userCount = 0;
  
  for await (const doc of userCursor) {
    if (doc.avatarUrl) {
      allUrls.push({ url: doc.avatarUrl, collection: 'users.avatarUrl' });
      userCount++;
    }
  }
  console.log(`   👤 Users: ${userCount} URLs`);

  totalUrls = limit > 0 ? Math.min(allUrls.length, limit) : allUrls.length;
  const urlsToProcess = limit > 0 ? allUrls.slice(0, limit) : allUrls;
  
  console.log(`\n📊 Total URLs to check: ${totalUrls}\n`);

  // Process all URLs
  console.log('🔄 Checking URLs and cleaning up R2...\n');
  const startTime = Date.now();
  
  await processUrlsWithConcurrency(urlsToProcess, concurrency, dryRun);

  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Total URLs checked: ${checkedUrls}`);
  console.log(`   ✅ Working URLs: ${workingUrls}`);
  console.log(`   ❌ Broken URLs: ${brokenUrls}`);
  console.log(`   ⏭️ Skipped: ${skippedUrls}`);
  console.log('');
  
  if (dryRun) {
    console.log(`   🗑️ Would delete from R2: ${deletedFromR2} files`);
  } else {
    console.log(`   🗑️ Deleted from R2: ${deletedFromR2} files`);
    console.log(`   ⚠️ Delete errors: ${deleteErrors}`);
  }
  
  console.log('');
  console.log(`   ⏱️ Time elapsed: ${elapsed.toFixed(1)} seconds`);
  console.log(`   📈 Rate: ${(checkedUrls / elapsed).toFixed(1)} URLs/sec`);

  // Report broken URLs
  if (brokenUrlsList.length > 0) {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('❌ Broken URLs (not found or errors)');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Group by collection
    const byCollection = brokenUrlsList.reduce((acc, item) => {
      if (!acc[item.collection]) acc[item.collection] = [];
      acc[item.collection].push(item);
      return acc;
    }, {} as Record<string, typeof brokenUrlsList>);

    for (const [collection, urls] of Object.entries(byCollection)) {
      console.log(`\n   ${collection}: ${urls.length} broken URLs`);
      // Show first 5 examples
      urls.slice(0, 5).forEach(({ url, status }) => {
        console.log(`      - ${url.substring(0, 80)}... (${status})`);
      });
      if (urls.length > 5) {
        console.log(`      ... and ${urls.length - 5} more`);
      }
    }

    // Save broken URLs to file
    const brokenUrlsFile = path.join(process.cwd(), 'broken-urls.json');
    fs.writeFileSync(brokenUrlsFile, JSON.stringify(brokenUrlsList, null, 2));
    console.log(`\n   📝 Full list saved to: ${brokenUrlsFile}`);
  }

  await mongoClient.close();
  console.log('\n✅ Done!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
