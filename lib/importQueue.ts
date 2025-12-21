import { getCollection } from '@/lib/db';
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
import { uploadToR2 } from '@/lib/r2';
import axios from 'axios';
import sharp from 'sharp';

// Import job status
export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

export interface ImportJob {
  _id?: ObjectId;
  type: 'artist' | 'tags' | 'single';
  query: string; // artist tag, search tags, or post ID
  limit: number;
  status: ImportJobStatus;
  progress: {
    current: number;
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  posts?: number[]; // Array of post IDs to import (populated when job starts)
  currentPostIndex?: number; // Track where we left off
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  createdBy: string; // username of who created the job
}

// Global flag to track if worker is running
let workerRunning = false;
let workerPromise: Promise<void> | null = null;

// Concurrent import settings
const CONCURRENT_IMPORTS = 3; // Number of parallel imports
const IMPORT_DELAY = 100; // Reduced delay between batches (ms)

async function downloadAndUploadImage(
  fileUrl: string,
  postId: number
): Promise<{ mainUrl: string; thumbnailUrl: string; width: number; height: number }> {
  const imageResponse = await axios.get(fileUrl, { 
    responseType: 'arraybuffer',
    timeout: 30000, // 30 second timeout
  });
  let imageBuffer = Buffer.from(imageResponse.data);

  let metadata;
  try {
    metadata = await sharp(imageBuffer).metadata();
  } catch (error) {
    try {
      imageBuffer = await sharp(imageBuffer).toFormat('jpeg', { quality: 90 }).toBuffer();
      metadata = await sharp(imageBuffer).metadata();
    } catch (convertError) {
      throw new Error('Unsupported image format and conversion failed');
    }
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;

  const timestamp = Date.now();
  let ext = fileUrl.split('.').pop()?.split('?')[0] || 'jpg';
  if (ext === 'webp' || ext === 'gif') {
    ext = 'jpg';
  }
  const mainFilename = `${timestamp}-danbooru-${postId}.${ext}`;
  const thumbFilename = `thumb-${timestamp}-danbooru-${postId}.jpg`;

  const mainUrl = await uploadToR2(imageBuffer, mainFilename, `image/${ext}`);

  const thumbnailBuffer = await sharp(imageBuffer)
    .resize(320, 320, { fit: 'cover' })
    .jpeg({ quality: 45, mozjpeg: true, progressive: true })
    .toBuffer();
  const thumbnailUrl = await uploadToR2(
    thumbnailBuffer,
    thumbFilename,
    'image/jpeg',
    'thumbnails'
  );

  return { mainUrl, thumbnailUrl, width, height };
}

async function importSinglePost(post: DanbooruPost): Promise<{
  success: boolean;
  error?: string;
  postId: number;
  imageId?: string;
  skipped?: boolean;
}> {
  try {
    const imagesCollection = await getCollection('images');
    const tagsCollection = await getCollection('tags');

    // Check if already imported
    const existing = await imagesCollection.findOne({ 'metadata.danbooruId': post.id });
    if (existing) {
      return { success: false, error: 'Post already imported', postId: post.id, skipped: true };
    }

    const fileUrl = post.file_url || post.large_file_url;
    if (!fileUrl) {
      return { success: false, error: 'No file URL available', postId: post.id, skipped: true };
    }

    const { mainUrl, thumbnailUrl, width, height } = await downloadAndUploadImage(fileUrl, post.id);

    // Extract and create tags
    const tagData = extractDanbooruTags(post);
    const tagIds: ObjectId[] = [];

    for (const tagInfo of tagData) {
      let tag = await tagsCollection.findOne({ name: tagInfo.name });
      if (!tag) {
        const result = await tagsCollection.insertOne({
          name: tagInfo.name,
          type: tagInfo.type,
          count: 0,
          createdAt: new Date(),
        });
        tagIds.push(result.insertedId);
      } else {
        tagIds.push(tag._id);
      }
    }

    const lastImage = await imagesCollection.findOne({}, { sort: { sequentialId: -1 } });
    const nextSequentialId = lastImage?.sequentialId ? lastImage.sequentialId + 1 : 1;

    const isAIGenerated = isAIPost(post);

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
      isAIGenerated,
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

    const result = await imagesCollection.insertOne(imageDoc);

    for (const tagId of tagIds) {
      await tagsCollection.updateOne({ _id: tagId }, { $inc: { count: 1 } });
    }

    return { success: true, imageId: result.insertedId.toString(), postId: post.id };
  } catch (error: any) {
    console.error(`[IMPORT] Error importing post ${post.id}:`, error.message);
    return { success: false, error: error.message, postId: post.id };
  }
}

// Process a batch of posts in parallel
async function processBatch(posts: DanbooruPost[]): Promise<{
  successful: number;
  failed: number;
  skipped: number;
}> {
  const results = await Promise.allSettled(
    posts.map(post => importSinglePost(post))
  );

  let successful = 0;
  let failed = 0;
  let skipped = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value.success) successful++;
      else if (result.value.skipped) skipped++;
      else failed++;
    } else {
      failed++;
    }
  }

  return { successful, failed, skipped };
}

// Main worker function that processes jobs from the queue
async function processImportQueue(): Promise<void> {
  if (workerRunning) {
    console.log('[IMPORT WORKER] Worker already running, skipping');
    return;
  }

  workerRunning = true;
  console.log('[IMPORT WORKER] Starting import queue worker');

  try {
    const jobsCollection = await getCollection('import_jobs');

    while (true) {
      // Find a pending or paused job (paused jobs are ones that were running when server restarted)
      const job = await jobsCollection.findOneAndUpdate(
        { status: { $in: ['pending', 'paused'] } },
        { 
          $set: { 
            status: 'running', 
            startedAt: new Date() 
          } 
        },
        { 
          sort: { createdAt: 1 },
          returnDocument: 'after'
        }
      );

      if (!job) {
        // No jobs to process
        console.log('[IMPORT WORKER] No pending jobs, stopping worker');
        break;
      }

      console.log(`[IMPORT WORKER] Processing job ${job._id}: ${job.type} - "${job.query}"`);

      try {
        let posts: DanbooruPost[] = [];
        let postIds: number[] = job.posts || [];

        // If we don't have the post list yet, fetch it
        if (postIds.length === 0) {
          console.log(`[IMPORT WORKER] Fetching posts for ${job.type}: "${job.query}"`);
          
          if (job.type === 'artist') {
            posts = await fetchDanbooruPostsByArtist(job.query, job.limit);
          } else if (job.type === 'tags') {
            posts = await fetchDanbooruPostsByTags(job.query, job.limit);
          } else if (job.type === 'single') {
            const post = await fetchDanbooruPost(parseInt(job.query));
            if (post) posts = [post];
          }

          postIds = posts.map(p => p.id);
          
          // Save the post IDs for resume capability
          await jobsCollection.updateOne(
            { _id: job._id },
            { 
              $set: { 
                posts: postIds,
                'progress.total': postIds.length,
                currentPostIndex: 0
              } 
            }
          );

          console.log(`[IMPORT WORKER] Found ${postIds.length} posts`);
        }

        if (postIds.length === 0) {
          await jobsCollection.updateOne(
            { _id: job._id },
            { 
              $set: { 
                status: 'failed',
                error: 'No posts found',
                completedAt: new Date()
              } 
            }
          );
          continue;
        }

        // Resume from where we left off
        const startIndex = job.currentPostIndex || 0;
        const remainingPostIds = postIds.slice(startIndex);

        console.log(`[IMPORT WORKER] Processing ${remainingPostIds.length} remaining posts (starting at index ${startIndex})`);

        // Process in batches with concurrent imports
        for (let i = 0; i < remainingPostIds.length; i += CONCURRENT_IMPORTS) {
          const batch = remainingPostIds.slice(i, i + CONCURRENT_IMPORTS);
          
          // Fetch the actual post data for this batch
          const batchPosts = await Promise.all(
            batch.map(async (postId) => {
              try {
                return await fetchDanbooruPost(postId);
              } catch {
                return null;
              }
            })
          );

          const validPosts = batchPosts.filter((p): p is DanbooruPost => p !== null);
          
          if (validPosts.length > 0) {
            const batchResults = await processBatch(validPosts);
            
            // Update progress in database
            const currentIndex = startIndex + i + batch.length;
            await jobsCollection.updateOne(
              { _id: job._id },
              {
                $set: { currentPostIndex: currentIndex },
                $inc: {
                  'progress.current': batch.length,
                  'progress.successful': batchResults.successful,
                  'progress.failed': batchResults.failed,
                  'progress.skipped': batchResults.skipped,
                },
              }
            );

            console.log(`[IMPORT WORKER] Job ${job._id}: ${currentIndex}/${postIds.length} (${batchResults.successful} success, ${batchResults.failed} failed, ${batchResults.skipped} skipped)`);
          }

          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, IMPORT_DELAY));
        }

        // Mark job as completed
        await jobsCollection.updateOne(
          { _id: job._id },
          { 
            $set: { 
              status: 'completed',
              completedAt: new Date()
            } 
          }
        );

        console.log(`[IMPORT WORKER] Job ${job._id} completed`);
      } catch (error: any) {
        console.error(`[IMPORT WORKER] Job ${job._id} failed:`, error);
        
        // Mark job as failed
        await jobsCollection.updateOne(
          { _id: job._id },
          { 
            $set: { 
              status: 'failed',
              error: error.message,
              completedAt: new Date()
            } 
          }
        );
      }
    }
  } catch (error) {
    console.error('[IMPORT WORKER] Worker error:', error);
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

  // Start the worker if not already running
  startImportWorker();

  return job;
}

// Start the import worker (safe to call multiple times)
export function startImportWorker(): void {
  if (!workerRunning && !workerPromise) {
    workerPromise = processImportQueue();
  }
}

// Get all jobs
export async function getImportJobs(limit = 50): Promise<ImportJob[]> {
  const jobsCollection = await getCollection('import_jobs');
  return jobsCollection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<ImportJob[]>;
}

// Get job by ID
export async function getImportJob(jobId: string): Promise<ImportJob | null> {
  const jobsCollection = await getCollection('import_jobs');
  return jobsCollection.findOne({ _id: new ObjectId(jobId) }) as Promise<ImportJob | null>;
}

// Cancel a job
export async function cancelImportJob(jobId: string): Promise<boolean> {
  const jobsCollection = await getCollection('import_jobs');
  const result = await jobsCollection.updateOne(
    { _id: new ObjectId(jobId), status: { $in: ['pending', 'running', 'paused'] } },
    { $set: { status: 'failed', error: 'Cancelled by user', completedAt: new Date() } }
  );
  return result.modifiedCount > 0;
}

// Mark running jobs as paused on server shutdown (call this in middleware or shutdown hook)
export async function pauseRunningJobs(): Promise<void> {
  const jobsCollection = await getCollection('import_jobs');
  await jobsCollection.updateMany(
    { status: 'running' },
    { $set: { status: 'paused' } }
  );
}

// Resume paused jobs on server startup
export async function resumePausedJobs(): Promise<void> {
  const jobsCollection = await getCollection('import_jobs');
  const pausedJobs = await jobsCollection.countDocuments({ status: 'paused' });
  
  if (pausedJobs > 0) {
    console.log(`[IMPORT] Found ${pausedJobs} paused jobs, starting worker to resume`);
    startImportWorker();
  }
}

// Delete old completed/failed jobs (cleanup)
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
