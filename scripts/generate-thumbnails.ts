import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { MongoClient, ObjectId } from 'mongodb';
import { uploadLocally } from '../lib/localStorage';
import { uploadToR2 } from '../lib/r2';

const MONGO_URI = process.env.MONGO_URI || '';
const MONGO_DB = process.env.MONGO_DB || 'serika-art';
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';

if (!MONGO_URI) {
  console.error('MONGO_URI environment variable is not set');
  process.exit(1);
}

async function fetchOriginal(url: string): Promise<Buffer> {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const response = await axios.get<ArrayBuffer>(url, { 
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB max
    });
    return Buffer.from(response.data);
  }

  const filePath = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
  return fs.readFile(filePath);
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}

async function createThumbnail(buffer: Buffer) {
  // For GIFs and animated images, take the first frame
  return sharp(buffer, { animated: false })
    .resize(320, 320, { fit: 'cover' })
    .jpeg({ quality: 45, mozjpeg: true, progressive: true })
    .toBuffer();
}

async function saveThumbnail(buffer: Buffer, filename: string) {
  const sanitized = sanitizeFilename(filename.endsWith('.jpg') ? filename : `${filename}.jpg`);

  if (USE_LOCAL_STORAGE) {
    return uploadLocally(buffer, sanitized, 'image/jpeg', 'thumbnails');
  }

  return uploadToR2(buffer, sanitized, 'image/jpeg', 'thumbnails');
}

async function processImage(doc: any, collection: any, index: number, total: number) {
  if (!doc.url) {
    console.warn(`[${index}/${total}] Skipping ${doc._id} - no url`);
    return { success: false, reason: 'no_url' };
  }

  if (doc.thumbnailUrl) {
    console.log(`[${index}/${total}] Skipping ${doc._id} - already has thumbnail`);
    return { success: false, reason: 'has_thumbnail' };
  }

  const baseName =
    doc.originalFilename || path.basename(doc.url || '') || `${doc._id.toString()}.jpg`;
  const thumbName = `thumb-${baseName}`;

  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Processing timeout after 60s')), 60000)
    );

    const processPromise = (async () => {
      const originalBuffer = await fetchOriginal(doc.url);
      const thumbnailBuffer = await createThumbnail(originalBuffer);
      const thumbnailUrl = await saveThumbnail(thumbnailBuffer, thumbName);

      await collection.updateOne(
        { _id: doc._id as ObjectId },
        { $set: { thumbnailUrl } }
      );

      return thumbnailUrl;
    })();

    await Promise.race([processPromise, timeoutPromise]);

    console.log(`[${index}/${total}] ✓ Updated thumbnail for ${doc._id}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[${index}/${total}] ✗ Failed to process ${doc._id}:`, error.message);
    return { success: false, reason: 'error', error: error.message };
  }
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(MONGO_DB);
    const images = db.collection('images');

    console.log('Fetching images without thumbnails...');
    const docs = await images
      .find({}, { projection: { _id: 1, url: 1, originalFilename: 1, thumbnailUrl: 1 } })
      .toArray();

    const total = docs.length;
    console.log(`Found ${total} total images`);

    const CHUNK_SIZE = 100;
    const CONCURRENCY = 5;

    let processed = 0;
    let created = 0;
    let skipped = 0;
    let failed = 0;

    // Process in chunks
    for (let chunkStart = 0; chunkStart < total; chunkStart += CHUNK_SIZE) {
      const chunk = docs.slice(chunkStart, chunkStart + CHUNK_SIZE);
      const chunkNum = Math.floor(chunkStart / CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(total / CHUNK_SIZE);
      
      console.log(`\n--- Processing chunk ${chunkNum}/${totalChunks} (${chunk.length} images) ---`);

      const queue: Promise<any>[] = [];
      
      for (let i = 0; i < chunk.length; i++) {
        const doc = chunk[i];
        const globalIndex = chunkStart + i + 1;
        const task = processImage(doc, images, globalIndex, total);
        queue.push(task);

        if (queue.length >= CONCURRENCY) {
          const results = await Promise.all(queue);
          results.forEach(r => {
            processed++;
            if (r.success) created++;
            else if (r.reason === 'has_thumbnail') skipped++;
            else failed++;
          });
          queue.length = 0;
        }
      }

      if (queue.length) {
        const results = await Promise.all(queue);
        results.forEach(r => {
          processed++;
          if (r.success) created++;
          else if (r.reason === 'has_thumbnail') skipped++;
          else failed++;
        });
      }

      console.log(`Chunk ${chunkNum} complete - Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);
    }

    console.log('\n=== Thumbnail generation complete ===');
    console.log(`Total: ${total} | Created: ${created} | Skipped: ${skipped} | Failed: ${failed}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
