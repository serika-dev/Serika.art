import { getCollection, getNextSequentialId } from '@/lib/db';
import { ObjectId } from 'mongodb';
import {
  fetchDanbooruPost,
  fetchDanbooruPostsByArtist,
  fetchDanbooruPostsByTags,
  mapDanbooruRating,
  extractDanbooruTags,
  isAIPost,
  DanbooruPost,
} from '@/lib/danbooru';
import { uploadToB2 } from '@/lib/b2';
import axios from 'axios';
import sharp from 'sharp';

// Import job status
export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

export interface ImportJob {
  _id?: ObjectId;
  type: 'artist' | 'tags' | 'single';
  query: string;
  limit: number;
  status: ImportJobStatus;
  progress: {
    current: number;
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  posts?: number[];
  currentPostIndex?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  createdBy: string;
}

// ============================================
// CONFIGURABLE SPEED MODES
// ============================================
export type SpeedMode = 'default' | 'turbo' | 'insane' | 'custom';

export interface SpeedSettings {
  concurrentJobs: number;
  concurrentImports: number;
  batchSize: number;
  importDelay: number;
  dbUpdateInterval: number;
}

const SPEED_PRESETS: Record<Exclude<SpeedMode, 'custom'>, SpeedSettings> = {
  default: {
    concurrentJobs: 2,
    concurrentImports: 5,
    batchSize: 10,
    importDelay: 50,
    dbUpdateInterval: 5,
  },
  turbo: {
    concurrentJobs: 5,
    concurrentImports: 20,
    batchSize: 50,
    importDelay: 10,
    dbUpdateInterval: 10,
  },
  insane: {
    concurrentJobs: 10,
    concurrentImports: 50,
    batchSize: 100,
    importDelay: 0,
    dbUpdateInterval: 20,
  },
};

// Current active settings (can be changed at runtime)
let currentMode: SpeedMode = 'insane';
let currentSettings: SpeedSettings = { ...SPEED_PRESETS.insane };

// Getters for current settings
export function getCurrentMode(): SpeedMode { return currentMode; }
export function getCurrentSettings(): SpeedSettings { return { ...currentSettings }; }

// Set speed mode (will take effect on next batch)
export function setSpeedMode(mode: SpeedMode, customSettings?: SpeedSettings): void {
  currentMode = mode;
  if (mode === 'custom' && customSettings) {
    currentSettings = { ...customSettings };
  } else if (mode !== 'custom') {
    currentSettings = { ...SPEED_PRESETS[mode] };
  }
  console.log(`[IMPORT] Speed mode changed to ${mode}:`, currentSettings);
}

// Global tracking
let workerRunning = false;
let workerPromise: Promise<void> | null = null;
let activeJobCount = 0;

// Tag cache to reduce DB lookups
const tagCache = new Map<string, ObjectId>();

// Atomic counter for sequential IDs - prevents race conditions


// Initialize counter if needed (run once on startup)
async function initializeCounter(): Promise<void> {
  const countersCollection = await getCollection('counters');
  const imagesCollection = await getCollection('images');
  
  const existing = await countersCollection.findOne({ name: 'imageSequentialId' });
  if (!existing) {
    // Find the highest existing sequentialId
    const lastImage = await imagesCollection.findOne(
      {},
      { sort: { sequentialId: -1 }, projection: { sequentialId: 1 } }
    );
    const maxId = lastImage?.sequentialId || 0;
    
    await countersCollection.insertOne({
      name: 'imageSequentialId',
      value: maxId
    });
    console.log(`[IMPORT] Initialized sequential ID counter at ${maxId}`);
  }
}

// Initialize on module load
let counterInitialized = false;
let indexesEnsured = false;

async function ensureCounterInitialized(): Promise<void> {
  if (!counterInitialized) {
    await initializeCounter();
    counterInitialized = true;
  }
}

// Ensure indexes exist for fast duplicate checking
async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  
  try {
    const imagesCollection = await getCollection('images');
    // Create index on metadata.danbooruId for fast duplicate lookups
    await imagesCollection.createIndex(
      { 'metadata.danbooruId': 1 },
      { sparse: true, background: true }
    );
    console.log('[IMPORT] Ensured index on metadata.danbooruId');
    indexesEnsured = true;
  } catch (error) {
    // Index might already exist, that's fine
    indexesEnsured = true;
  }
}

// Batch check for existing posts - much faster than checking one by one
async function filterAlreadyImported(
  postIds: number[],
  imagesCollection: any
): Promise<Set<number>> {
  const existing = await imagesCollection
    .find(
      { 'metadata.danbooruId': { $in: postIds } },
      { projection: { 'metadata.danbooruId': 1 } }
    )
    .toArray();
  
  return new Set(existing.map((doc: any) => doc.metadata?.danbooruId).filter(Boolean));
}

async function getOrCreateTagsBulk(
  tagsCollection: any,
  tagData: Array<{ name: string; type: string }>
): Promise<ObjectId[]> {
  const tagIds: ObjectId[] = [];
  const uncachedTags: Array<{ name: string; type: string }> = [];

  // Check cache first
  for (const t of tagData) {
    const cached = tagCache.get(t.name);
    if (cached) {
      tagIds.push(cached);
    } else {
      uncachedTags.push(t);
    }
  }

  if (uncachedTags.length > 0) {
    // Bulk find existing tags
    const existingTags = await tagsCollection
      .find({ name: { $in: uncachedTags.map(t => t.name) } })
      .toArray();

    const existingMap = new Map<string, ObjectId>(existingTags.map((t: any) => [t.name, t._id as ObjectId]));

    // Process uncached tags
    for (const t of uncachedTags) {
      if (existingMap.has(t.name)) {
        const id = existingMap.get(t.name)!;
        tagCache.set(t.name, id);
        tagIds.push(id);
      } else {
        // Create new tag
        const result = await tagsCollection.insertOne({
          name: t.name,
          type: t.type,
          count: 0,
          createdAt: new Date(),
        });
        tagCache.set(t.name, result.insertedId);
        tagIds.push(result.insertedId);
      }
    }
  }

  return tagIds;
}

async function downloadAndUploadImage(
  fileUrl: string,
  postId: number
): Promise<{ mainUrl: string; thumbnailUrl: string; width: number; height: number }> {
  const imageResponse = await axios.get(fileUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxContentLength: 100 * 1024 * 1024,
  });
  let imageBuffer = Buffer.from(imageResponse.data);

  let metadata;
  try {
    metadata = await sharp(imageBuffer).metadata();
  } catch {
    try {
      imageBuffer = await sharp(imageBuffer).toFormat('jpeg', { quality: 90 }).toBuffer();
      metadata = await sharp(imageBuffer).metadata();
    } catch {
      throw new Error('Unsupported image format');
    }
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;

  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(7);
  let ext = fileUrl.split('.').pop()?.split('?')[0] || 'jpg';
  if (ext === 'webp' || ext === 'gif') ext = 'jpg';
  
  const mainFilename = `${timestamp}-${rand}-danbooru-${postId}.${ext}`;
  const thumbFilename = `thumb-${timestamp}-${rand}-danbooru-${postId}.jpg`;

  // Upload main and thumbnail in parallel
  const [mainUrl, thumbnailUrl] = await Promise.all([
    uploadToB2(imageBuffer, mainFilename, `image/${ext}`),
    sharp(imageBuffer)
      .resize(320, 320, { fit: 'cover' })
      .jpeg({ quality: 45, mozjpeg: true, progressive: true })
      .toBuffer()
      .then(thumbBuffer => uploadToB2(thumbBuffer, thumbFilename, 'image/jpeg', 'thumbnails'))
  ]);

  return { mainUrl, thumbnailUrl, width, height };
}

interface ImportResult {
  success: boolean;
  error?: string;
  postId: number;
  skipped?: boolean;
}

async function importSinglePost(
  post: DanbooruPost,
  imagesCollection: any,
  tagsCollection: any
): Promise<ImportResult> {
  try {
    // Quick check if already imported
    const existing = await imagesCollection.findOne(
      { 'metadata.danbooruId': post.id },
      { projection: { _id: 1 } }
    );
    if (existing) {
      return { success: false, postId: post.id, skipped: true };
    }

    const fileUrl = post.file_url || post.large_file_url;
    if (!fileUrl) {
      return { success: false, error: 'No file URL', postId: post.id, skipped: true };
    }

    const { mainUrl, thumbnailUrl, width, height } = await downloadAndUploadImage(fileUrl, post.id);

    // Get/create tags using bulk operation
    const tagData = extractDanbooruTags(post);
    const tagIds = await getOrCreateTagsBulk(tagsCollection, tagData);

    // Get next sequential ID using ATOMIC counter (no race conditions!)
    await ensureCounterInitialized();
    const nextSequentialId = await getNextSequentialId();

    const imageDoc = {
      sequentialId: nextSequentialId,
      userId: null,
      username: 'Anonymous',
      url: mainUrl,
      thumbnailUrl,
      originalFilename: `danbooru-${post.id}.${post.file_ext}`,
      fileSize: post.file_size || 0,
      width,
      height,
      contentType: `image/${post.file_ext}`,
      tags: tagIds,
      rating: mapDanbooruRating(post.rating),
      isAIGenerated: isAIPost(post),
      source: post.source || `https://danbooru.donmai.us/posts/${post.id}`,
      description: '',
      upvotes: 0,
      downvotes: 0,
      favorites: 0,
      views: 0,
      metadata: {
        danbooruId: post.id,
        md5: post.md5,
        source: post.source || `https://danbooru.donmai.us/posts/${post.id}`,
        importedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await imagesCollection.insertOne(imageDoc);

    // Bulk increment tag counts
    if (tagIds.length > 0) {
      await tagsCollection.updateMany(
        { _id: { $in: tagIds } },
        { $inc: { count: 1 } }
      );
    }

    return { success: true, postId: post.id };
  } catch (error: any) {
    return { success: false, error: error.message, postId: post.id };
  }
}

// Prefetch posts in batches for speed
// Now properly rate limited by danbooru.ts request queue
async function prefetchPosts(postIds: number[]): Promise<Map<number, DanbooruPost>> {
  const results = new Map<number, DanbooruPost>();
  
  // Fetch all in parallel - the danbooru module handles rate limiting internally
  const posts = await Promise.all(
    postIds.map(async (id) => {
      try {
        return await fetchDanbooruPost(id);
      } catch {
        return null;
      }
    })
  );
  
  posts.forEach((post, idx) => {
    if (post) results.set(postIds[idx], post);
  });

  return results;
}

// Check if a job was externally paused or cancelled
async function isJobStillRunning(jobId: ObjectId): Promise<boolean> {
  const jobsCollection = await getCollection('import_jobs');
  const job = await jobsCollection.findOne(
    { _id: jobId },
    { projection: { status: 1 } }
  );
  return job?.status === 'running';
}

// Process a single job with maximum speed
async function processJob(job: ImportJob): Promise<void> {
  const jobsCollection = await getCollection('import_jobs');
  const imagesCollection = await getCollection('images');
  const tagsCollection = await getCollection('tags');

  // Ensure indexes exist for fast duplicate checking
  await ensureIndexes();

  console.log(`[JOB ${job._id}] Starting: ${job.type} - "${job.query}" (limit: ${job.limit === 0 ? 'UNLIMITED' : job.limit})`);

  try {
    let postIds: number[] = job.posts || [];

    // Fetch post list if needed
    if (postIds.length === 0) {
      console.log(`[JOB ${job._id}] Fetching post list...`);
      
      let posts: DanbooruPost[] = [];
      if (job.type === 'artist') {
        posts = await fetchDanbooruPostsByArtist(job.query, job.limit);
      } else if (job.type === 'tags') {
        posts = await fetchDanbooruPostsByTags(job.query, job.limit);
      } else if (job.type === 'single') {
        const post = await fetchDanbooruPost(parseInt(job.query));
        if (post) posts = [post];
      }

      postIds = posts.map(p => p.id);
      
      // Pre-filter already imported posts before saving
      const alreadyImported = await filterAlreadyImported(postIds, imagesCollection);
      const newPostIds = postIds.filter(id => !alreadyImported.has(id));
      
      console.log(`[JOB ${job._id}] Found ${postIds.length} posts, ${alreadyImported.size} already imported, ${newPostIds.length} new`);
      
      await jobsCollection.updateOne(
        { _id: job._id },
        { 
          $set: { 
            posts: newPostIds, 
            'progress.total': newPostIds.length,
            'progress.skipped': alreadyImported.size,
            currentPostIndex: 0 
          } 
        }
      );
      
      postIds = newPostIds;
    }

    if (postIds.length === 0) {
      await jobsCollection.updateOne(
        { _id: job._id },
        { $set: { status: 'completed', completedAt: new Date() } }
      );
      console.log(`[JOB ${job._id}] All posts already imported, marking complete`);
      return;
    }

    // Resume from where we left off
    const startIndex = job.currentPostIndex || 0;
    const remainingPostIds = postIds.slice(startIndex);

    console.log(`[JOB ${job._id}] Processing ${remainingPostIds.length} posts (from index ${startIndex})`);

    let successful = 0;
    let failed = 0;
    let skipped = job.progress?.skipped || 0;
    let processedSinceUpdate = 0;

    // Process in large batches with prefetching
    const { batchSize, concurrentImports, importDelay, dbUpdateInterval } = currentSettings;
    for (let i = 0; i < remainingPostIds.length; i += batchSize) {
      // Check if job was paused/cancelled externally
      if (!(await isJobStillRunning(job._id!))) {
        console.log(`[JOB ${job._id}] Job was paused/cancelled externally, stopping gracefully`);
        // Save current progress before exiting
        const currentIndex = startIndex + i;
        await jobsCollection.updateOne(
          { _id: job._id },
          {
            $set: {
              currentPostIndex: currentIndex,
              'progress.current': currentIndex,
              'progress.successful': successful,
              'progress.failed': failed,
              'progress.skipped': skipped,
            },
          }
        );
        return; // Exit gracefully without marking as completed/failed
      }

      const batchIds = remainingPostIds.slice(i, i + batchSize);
      
      // Prefetch post data for this batch
      const postDataMap = await prefetchPosts(batchIds);
      const validPosts = batchIds
        .map(id => postDataMap.get(id))
        .filter((p): p is DanbooruPost => p !== null);

      // Process posts in parallel
      for (let j = 0; j < validPosts.length; j += concurrentImports) {
        const chunk = validPosts.slice(j, j + concurrentImports);
        
        const results = await Promise.allSettled(
          chunk.map(post => importSinglePost(post, imagesCollection, tagsCollection))
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            if (result.value.success) successful++;
            else if (result.value.skipped) skipped++;
            else failed++;
          } else {
            failed++;
          }
          processedSinceUpdate++;
        }

        // Update progress periodically
        if (processedSinceUpdate >= dbUpdateInterval) {
          const currentIndex = startIndex + i + j + chunk.length;
          await jobsCollection.updateOne(
            { _id: job._id },
            {
              $set: {
                currentPostIndex: currentIndex,
                'progress.current': currentIndex,
                'progress.successful': successful,
                'progress.failed': failed,
                'progress.skipped': skipped,
              },
            }
          );
          processedSinceUpdate = 0;
          
          console.log(`[JOB ${job._id}] Progress: ${currentIndex}/${postIds.length} (✓${successful} ✗${failed} ⊘${skipped})`);
        }

        if (importDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, importDelay));
        }
      }
    }

    // Final update
    await jobsCollection.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          currentPostIndex: postIds.length,
          'progress.current': postIds.length,
          'progress.successful': successful,
          'progress.failed': failed,
          'progress.skipped': skipped,
        },
      }
    );

    console.log(`[JOB ${job._id}] COMPLETED: ✓${successful} ✗${failed} ⊘${skipped}`);
  } catch (error: any) {
    console.error(`[JOB ${job._id}] FAILED:`, error.message);
    await jobsCollection.updateOne(
      { _id: job._id },
      { $set: { status: 'failed', error: error.message, completedAt: new Date() } }
    );
  }
}

// Main worker - processes multiple jobs concurrently
async function processImportQueue(): Promise<void> {
  if (workerRunning) {
    console.log('[IMPORT WORKER] Already running, skipping');
    return;
  }

  workerRunning = true;
  activeJobCount = 0;
  console.log(`[IMPORT WORKER] 🔥 ${currentMode.toUpperCase()} MODE - ${currentSettings.concurrentJobs} jobs × ${currentSettings.concurrentImports} imports`);

  try {
    const jobsCollection = await getCollection('import_jobs');

    // First, reset any stuck "running" jobs to "paused" (from previous crash/restart)
    const stuckJobs = await jobsCollection.updateMany(
      { status: 'running' },
      { $set: { status: 'paused' } }
    );
    if (stuckJobs.modifiedCount > 0) {
      console.log(`[IMPORT WORKER] Reset ${stuckJobs.modifiedCount} stuck running jobs to paused`);
    }

    while (true) {
      // Check how many jobs we can start
      const slotsAvailable = currentSettings.concurrentJobs - activeJobCount;
      
      if (slotsAvailable <= 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Get multiple pending jobs at once
      const pendingJobs = await jobsCollection
        .find({ status: { $in: ['pending', 'paused'] } })
        .sort({ createdAt: 1 })
        .limit(slotsAvailable)
        .toArray() as ImportJob[];

      if (pendingJobs.length === 0 && activeJobCount === 0) {
        console.log('[IMPORT WORKER] No more jobs, stopping');
        break;
      }

      if (pendingJobs.length === 0) {
        // No new jobs but some are still running, wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      console.log(`[IMPORT WORKER] Starting ${pendingJobs.length} new jobs (${activeJobCount} already running)`);

      // Start jobs in parallel
      for (const job of pendingJobs) {
        await jobsCollection.updateOne(
          { _id: job._id },
          { $set: { status: 'running', startedAt: new Date() } }
        );

        activeJobCount++;
        
        processJob(job).finally(() => {
          activeJobCount--;
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error('[IMPORT WORKER] Fatal error:', error);
  } finally {
    workerRunning = false;
    workerPromise = null;
    console.log('[IMPORT WORKER] Worker stopped');
  }
}

// Create a new import job
export async function createImportJob(
  type: 'artist' | 'tags' | 'single',
  query: string,
  limit: number,
  createdBy: string
): Promise<ImportJob> {
  const jobsCollection = await getCollection('import_jobs');

  const job: ImportJob = {
    type,
    query,
    limit,
    status: 'pending',
    progress: {
      current: 0,
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    },
    createdAt: new Date(),
    createdBy,
  };

  const result = await jobsCollection.insertOne(job);
  job._id = result.insertedId;

  startImportWorker();

  return job;
}

export function startImportWorker(): void {
  if (!workerRunning && !workerPromise) {
    workerPromise = processImportQueue();
  }
}

export async function getImportJobs(limit = 50): Promise<ImportJob[]> {
  const jobsCollection = await getCollection('import_jobs');
  return jobsCollection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<ImportJob[]>;
}

export async function getImportJob(jobId: string): Promise<ImportJob | null> {
  const jobsCollection = await getCollection('import_jobs');
  return jobsCollection.findOne({ _id: new ObjectId(jobId) }) as Promise<ImportJob | null>;
}

export async function cancelImportJob(jobId: string): Promise<boolean> {
  const jobsCollection = await getCollection('import_jobs');
  const result = await jobsCollection.updateOne(
    { _id: new ObjectId(jobId), status: { $in: ['pending', 'running', 'paused'] } },
    { $set: { status: 'failed', error: 'Cancelled by user', completedAt: new Date() } }
  );
  return result.modifiedCount > 0;
}

export async function pauseRunningJobs(): Promise<void> {
  const jobsCollection = await getCollection('import_jobs');
  await jobsCollection.updateMany(
    { status: 'running' },
    { $set: { status: 'paused' } }
  );
}

export async function resumePausedJobs(): Promise<void> {
  const jobsCollection = await getCollection('import_jobs');
  
  // First, reset any stuck "running" jobs to "paused" (server might have restarted)
  const stuckJobs = await jobsCollection.updateMany(
    { status: 'running' },
    { $set: { status: 'paused' } }
  );
  if (stuckJobs.modifiedCount > 0) {
    console.log(`[IMPORT] Reset ${stuckJobs.modifiedCount} stuck running jobs to paused`);
  }
  
  const pausedJobs = await jobsCollection.countDocuments({ status: 'paused' });
  const pendingJobs = await jobsCollection.countDocuments({ status: 'pending' });
  
  console.log(`[IMPORT] Jobs status: ${pausedJobs} paused, ${pendingJobs} pending`);
  
  if (pausedJobs > 0 || pendingJobs > 0) {
    console.log(`[IMPORT] Starting worker to process ${pausedJobs + pendingJobs} jobs...`);
    // Force restart the worker
    workerRunning = false;
    workerPromise = null;
    startImportWorker();
  } else {
    console.log('[IMPORT] No jobs to process');
  }
}

export async function cleanupOldJobs(daysOld = 7): Promise<number> {
  const jobsCollection = await getCollection('import_jobs');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await jobsCollection.deleteMany({
    status: { $in: ['completed', 'failed'] },
    completedAt: { $lt: cutoffDate }
  });
  
  return result.deletedCount;
}

// Clear all completed jobs (for manual cleanup)
export async function clearCompletedJobs(): Promise<number> {
  const jobsCollection = await getCollection('import_jobs');
  const result = await jobsCollection.deleteMany({
    status: 'completed'
  });
  
  console.log(`[IMPORT] Cleared ${result.deletedCount} completed jobs`);
  return result.deletedCount;
}

// Clear all failed jobs (for manual cleanup)
export async function clearFailedJobs(): Promise<number> {
  const jobsCollection = await getCollection('import_jobs');
  const result = await jobsCollection.deleteMany({
    status: 'failed'
  });
  
  console.log(`[IMPORT] Cleared ${result.deletedCount} failed jobs`);
  return result.deletedCount;
}
