import { query, withTransaction } from '@/lib/db';
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
  id: number;
  type: 'artist' | 'tags' | 'single';
  query: string;
  limit_val: number;
  status: ImportJobStatus;
  progress: {
    current: number;
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  posts?: number[];
  current_post_index?: number;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  error?: string;
  created_by?: string;
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
const tagCache = new Map<string, number>();

// Batch check for existing posts - much faster than checking one by one
async function filterAlreadyImported(postIds: number[]): Promise<Set<number>> {
  if (postIds.length === 0) return new Set();
  const existing = await query(
    `SELECT metadata->>'danbooruId' as danbooru_id FROM images WHERE metadata->>'danbooruId' = ANY($1)`,
    [postIds.map(String)]
  );
  return new Set(existing.rows.map((row: any) => parseInt(row.danbooru_id, 10)).filter(Boolean));
}

async function getOrCreateTagsBulk(
  tagData: Array<{ name: string; type: string }>
): Promise<number[]> {
  const tagIds: number[] = [];
  const uncachedTags: Array<{ name: string; type: string }> = [];

  // Check cache first
  for (const t of tagData) {
    const normalizedName = t.name.toLowerCase().replace(/\s+/g, '_');
    const cached = tagCache.get(normalizedName);
    if (cached) {
      tagIds.push(cached);
    } else {
      uncachedTags.push({ name: normalizedName, type: t.type });
    }
  }

  if (uncachedTags.length > 0) {
    // Bulk find existing tags
    const existingTags = await query(
      `SELECT id, name FROM tags WHERE name = ANY($1)`,
      [uncachedTags.map(t => t.name)]
    );

    const existingMap = new Map<string, number>(existingTags.rows.map((t: any) => [t.name, t.id]));

    // Process uncached tags
    for (const t of uncachedTags) {
      if (existingMap.has(t.name)) {
        const id = existingMap.get(t.name)!;
        tagCache.set(t.name, id);
        tagIds.push(id);
      } else {
        // Create new tag
        try {
          const result = await query(
            `INSERT INTO tags (name, type, count, created_at)
             VALUES ($1, $2, 0, NOW())
             ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [t.name, t.type]
          );
          const id = result.rows[0].id;
          tagCache.set(t.name, id);
          tagIds.push(id);
        } catch (err) {
          // Handle unique constraint races by re-querying
          const refetch = await query(`SELECT id FROM tags WHERE name = $1`, [t.name]);
          if (refetch.rows.length > 0) {
            const id = refetch.rows[0].id;
            tagCache.set(t.name, id);
            tagIds.push(id);
          }
        }
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

async function importSinglePost(post: DanbooruPost): Promise<ImportResult> {
  try {
    // Quick check if already imported
    const existing = await query(
      `SELECT id FROM images WHERE metadata->>'danbooruId' = $1`,
      [String(post.id)]
    );
    if (existing.rows.length > 0) {
      return { success: false, postId: post.id, skipped: true };
    }

    const fileUrl = post.file_url || post.large_file_url;
    if (!fileUrl) {
      return { success: false, error: 'No file URL', postId: post.id, skipped: true };
    }

    const { mainUrl, thumbnailUrl, width, height } = await downloadAndUploadImage(fileUrl, post.id);

    // Get/create tags using bulk operation
    const tagData = extractDanbooruTags(post);
    const tagIds = await getOrCreateTagsBulk(tagData);

    const metadataJson = {
      danbooruId: post.id,
      md5: post.md5,
      source: post.source || `https://danbooru.donmai.us/posts/${post.id}`,
      importedAt: new Date().toISOString(),
    };

    // Run transaction for image creation (sequential ID allocated atomically inside)
    await withTransaction(async (client) => {
      // Get next sequential ID INSIDE the transaction to prevent races
      const seqResult = await client.query(
        `INSERT INTO counters (name, value)
         VALUES ('imageSequentialId', 1)
         ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
         RETURNING value`
      );
      const nextSequentialId = seqResult.rows[0].value;

      const imgRes = await client.query(
        `INSERT INTO images (
          sequential_id, user_id, username, url, thumbnail_url,
          original_filename, file_size, width, height, content_type,
          rating, is_ai_generated, source, description,
          upvotes, downvotes, favorites, views, metadata,
          created_at, updated_at
        ) VALUES ($1, null, 'Anonymous', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '', 0, 0, 0, 0, $12, NOW(), NOW())
        RETURNING id`,
        [
          nextSequentialId,
          mainUrl,
          thumbnailUrl,
          `danbooru-${post.id}.${post.file_ext}`,
          post.file_size || 0,
          width,
          height,
          `image/${post.file_ext}`,
          mapDanbooruRating(post.rating),
          isAIPost(post),
          post.source || `https://danbooru.donmai.us/posts/${post.id}`,
          JSON.stringify(metadataJson),
        ]
      );

      const newImageId = imgRes.rows[0].id;

      // Insert image_tags relationships
      if (tagIds.length > 0) {
        const values = tagIds.map((_, idx) => `($1, $${idx + 2})`).join(', ');
        await client.query(
          `INSERT INTO image_tags (image_id, tag_id) VALUES ${values}`,
          [newImageId, ...tagIds]
        );

        // Increment tag counts
        await client.query(
          `UPDATE tags SET count = count + 1 WHERE id = ANY($1::int[])`,
          [tagIds]
        );
      }
    });

    return { success: true, postId: post.id };
  } catch (error: any) {
    return { success: false, error: error.message, postId: post.id };
  }
}

// Prefetch posts in batches for speed
async function prefetchPosts(postIds: number[]): Promise<Map<number, DanbooruPost>> {
  const results = new Map<number, DanbooruPost>();
  
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
async function isJobStillRunning(jobId: number): Promise<boolean> {
  const result = await query(`SELECT status FROM import_jobs WHERE id = $1`, [jobId]);
  return result.rows[0]?.status === 'running';
}

// Process a single job with maximum speed
async function processJob(job: ImportJob): Promise<void> {
  console.log(`[JOB ${job.id}] Starting: ${job.type} - "${job.query}" (limit: ${job.limit_val === 0 ? 'UNLIMITED' : job.limit_val})`);

  try {
    let postIds: number[] = job.posts || [];

    // Fetch post list if needed
    if (postIds.length === 0) {
      console.log(`[JOB ${job.id}] Fetching post list...`);
      
      let posts: DanbooruPost[] = [];
      if (job.type === 'artist') {
        posts = await fetchDanbooruPostsByArtist(job.query, job.limit_val);
      } else if (job.type === 'tags') {
        posts = await fetchDanbooruPostsByTags(job.query, job.limit_val);
      } else if (job.type === 'single') {
        const post = await fetchDanbooruPost(parseInt(job.query, 10));
        if (post) posts = [post];
      }

      postIds = posts.map(p => p.id);
      
      // Pre-filter already imported posts before saving
      const alreadyImported = await filterAlreadyImported(postIds);
      const newPostIds = postIds.filter(id => !alreadyImported.has(id));
      
      console.log(`[JOB ${job.id}] Found ${postIds.length} posts, ${alreadyImported.size} already imported, ${newPostIds.length} new`);
      
      const newProgress = {
        current: 0,
        total: newPostIds.length,
        successful: 0,
        failed: 0,
        skipped: alreadyImported.size,
      };

      await query(
        `UPDATE import_jobs
         SET posts = $1, progress = $2, current_post_index = 0
         WHERE id = $3`,
        [JSON.stringify(newPostIds), JSON.stringify(newProgress), job.id]
      );
      
      postIds = newPostIds;
      job.progress = newProgress;
    }

    if (postIds.length === 0) {
      await query(
        `UPDATE import_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [job.id]
      );
      console.log(`[JOB ${job.id}] All posts already imported, marking complete`);
      return;
    }

    // Resume from where we left off
    const startIndex = job.current_post_index || 0;
    const remainingPostIds = postIds.slice(startIndex);

    console.log(`[JOB ${job.id}] Processing ${remainingPostIds.length} posts (from index ${startIndex})`);

    let successful = job.progress?.successful || 0;
    let failed = job.progress?.failed || 0;
    let skipped = job.progress?.skipped || 0;
    let processedSinceUpdate = 0;

    // Process in large batches with prefetching
    const { batchSize, concurrentImports, importDelay, dbUpdateInterval } = currentSettings;
    for (let i = 0; i < remainingPostIds.length; i += batchSize) {
      // Check if job was paused/cancelled externally
      if (!(await isJobStillRunning(job.id))) {
        console.log(`[JOB ${job.id}] Job was paused/cancelled externally, stopping gracefully`);
        const currentIndex = startIndex + i;
        const savedProgress = {
          current: currentIndex,
          total: postIds.length,
          successful,
          failed,
          skipped,
        };

        await query(
          `UPDATE import_jobs
           SET current_post_index = $1, progress = $2
           WHERE id = $3`,
          [currentIndex, JSON.stringify(savedProgress), job.id]
        );
        return;
      }

      const batchIds = remainingPostIds.slice(i, i + batchSize);
      
      // Prefetch post data for this batch
      const postDataMap = await prefetchPosts(batchIds);
      const validPosts = batchIds
        .map(id => postDataMap.get(id))
        .filter((p): p is DanbooruPost => p !== undefined && p !== null);

      // Process posts in parallel
      for (let j = 0; j < validPosts.length; j += concurrentImports) {
        const chunk = validPosts.slice(j, j + concurrentImports);
        
        const results = await Promise.allSettled(
          chunk.map(post => importSinglePost(post))
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
          const currentProgress = {
            current: currentIndex,
            total: postIds.length,
            successful,
            failed,
            skipped,
          };

          await query(
            `UPDATE import_jobs
             SET current_post_index = $1, progress = $2
             WHERE id = $3`,
            [currentIndex, JSON.stringify(currentProgress), job.id]
          );
          processedSinceUpdate = 0;
          
          console.log(`[JOB ${job.id}] Progress: ${currentIndex}/${postIds.length} (✓${successful} ✗${failed} ⊘${skipped})`);
        }

        if (importDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, importDelay));
        }
      }
    }

    // Final update
    const finalProgress = {
      current: postIds.length,
      total: postIds.length,
      successful,
      failed,
      skipped,
    };

    await query(
      `UPDATE import_jobs
       SET status = 'completed', completed_at = NOW(), current_post_index = $1, progress = $2
       WHERE id = $3`,
      [postIds.length, JSON.stringify(finalProgress), job.id]
    );

    console.log(`[JOB ${job.id}] COMPLETED: ✓${successful} ✗${failed} ⊘${skipped}`);
  } catch (error: any) {
    console.error(`[JOB ${job.id}] FAILED:`, error.message);
    await query(
      `UPDATE import_jobs SET status = 'failed', error = $1, completed_at = NOW() WHERE id = $2`,
      [error.message, job.id]
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
    // First, reset any stuck "running" jobs to "paused"
    const stuckJobs = await query(`UPDATE import_jobs SET status = 'paused' WHERE status = 'running'`);
    
    while (true) {
      const slotsAvailable = currentSettings.concurrentJobs - activeJobCount;
      
      if (slotsAvailable <= 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Get pending/paused jobs
      const pendingJobsResult = await query(
        `SELECT * FROM import_jobs
         WHERE status IN ('pending', 'paused')
         ORDER BY created_at ASC
         LIMIT $1`,
        [slotsAvailable]
      );

      const pendingJobs: ImportJob[] = pendingJobsResult.rows.map((row: any) => ({
        id: row.id,
        type: row.type,
        query: row.query,
        limit_val: row.limit_val,
        status: row.status,
        progress: row.progress || { current: 0, total: 0, successful: 0, failed: 0, skipped: 0 },
        posts: row.posts || [],
        current_post_index: row.current_post_index || 0,
        created_at: row.created_at,
        started_at: row.started_at,
        completed_at: row.completed_at,
        error: row.error,
        created_by: row.created_by,
      }));

      if (pendingJobs.length === 0 && activeJobCount === 0) {
        console.log('[IMPORT WORKER] No more jobs, stopping');
        break;
      }

      if (pendingJobs.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      console.log(`[IMPORT WORKER] Starting ${pendingJobs.length} new jobs (${activeJobCount} already running)`);

      for (const job of pendingJobs) {
        await query(
          `UPDATE import_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
          [job.id]
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
  queryStr: string,
  limitVal: number,
  createdBy: string
): Promise<ImportJob> {
  const progressInit = {
    current: 0,
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
  };

  const result = await query(
    `INSERT INTO import_jobs (type, query, limit_val, status, progress, posts, current_post_index, created_at, created_by)
     VALUES ($1, $2, $3, 'pending', $4, '[]'::jsonb, 0, NOW(), $5)
     RETURNING *`,
    [type, queryStr, limitVal, JSON.stringify(progressInit), createdBy]
  );

  const row = result.rows[0];
  const job: ImportJob = {
    id: row.id,
    type: row.type,
    query: row.query,
    limit_val: row.limit_val,
    status: row.status,
    progress: row.progress || progressInit,
    posts: row.posts || [],
    current_post_index: row.current_post_index || 0,
    created_at: row.created_at,
    created_by: row.created_by,
  };

  startImportWorker();

  return job;
}

export function startImportWorker(): void {
  if (!workerRunning && !workerPromise) {
    workerPromise = processImportQueue();
  }
}

export async function getImportJobs(limit = 50): Promise<ImportJob[]> {
  const result = await query(
    `SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows.map((row: any) => ({
    id: row.id,
    type: row.type,
    query: row.query,
    limit_val: row.limit_val,
    status: row.status,
    progress: row.progress || { current: 0, total: 0, successful: 0, failed: 0, skipped: 0 },
    posts: row.posts || [],
    current_post_index: row.current_post_index || 0,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    error: row.error,
    created_by: row.created_by,
  }));
}

export async function getImportJob(jobId: string): Promise<ImportJob | null> {
  const parsedId = parseInt(jobId, 10);
  if (isNaN(parsedId)) return null;

  const result = await query(`SELECT * FROM import_jobs WHERE id = $1`, [parsedId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    type: row.type,
    query: row.query,
    limit_val: row.limit_val,
    status: row.status,
    progress: row.progress || { current: 0, total: 0, successful: 0, failed: 0, skipped: 0 },
    posts: row.posts || [],
    current_post_index: row.current_post_index || 0,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    error: row.error,
    created_by: row.created_by,
  };
}

export async function cancelImportJob(jobId: string): Promise<boolean> {
  const parsedId = parseInt(jobId, 10);
  if (isNaN(parsedId)) return false;

  const result = await query(
    `UPDATE import_jobs
     SET status = 'failed', error = 'Cancelled by user', completed_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'running', 'paused')`,
    [parsedId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function pauseRunningJobs(): Promise<void> {
  await query(`UPDATE import_jobs SET status = 'paused' WHERE status = 'running'`);
}

export async function resumePausedJobs(): Promise<void> {
  // Reset stuck running jobs to paused
  await query(`UPDATE import_jobs SET status = 'paused' WHERE status = 'running'`);
  
  const pausedRes = await query(`SELECT COUNT(*) FROM import_jobs WHERE status = 'paused'`);
  const pendingRes = await query(`SELECT COUNT(*) FROM import_jobs WHERE status = 'pending'`);
  
  const pausedJobs = parseInt(pausedRes.rows[0].count, 10);
  const pendingJobs = parseInt(pendingRes.rows[0].count, 10);
  
  console.log(`[IMPORT] Jobs status: ${pausedJobs} paused, ${pendingJobs} pending`);
  
  if (pausedJobs > 0 || pendingJobs > 0) {
    console.log(`[IMPORT] Starting worker to process ${pausedJobs + pendingJobs} jobs...`);
    workerRunning = false;
    workerPromise = null;
    startImportWorker();
  } else {
    console.log('[IMPORT] No jobs to process');
  }
}

export async function cleanupOldJobs(daysOld = 7): Promise<number> {
  const result = await query(
    `DELETE FROM import_jobs
     WHERE status IN ('completed', 'failed')
       AND completed_at < NOW() - $1 * INTERVAL '1 day'`,
    [daysOld]
  );
  return result.rowCount ?? 0;
}

export async function clearCompletedJobs(): Promise<number> {
  const result = await query(`DELETE FROM import_jobs WHERE status = 'completed'`);
  console.log(`[IMPORT] Cleared ${result.rowCount} completed jobs`);
  return result.rowCount ?? 0;
}

export async function clearFailedJobs(): Promise<number> {
  const result = await query(`DELETE FROM import_jobs WHERE status = 'failed'`);
  console.log(`[IMPORT] Cleared ${result.rowCount} failed jobs`);
  return result.rowCount ?? 0;
}
