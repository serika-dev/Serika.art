import { cacheGet, getRedis, importQuery, query } from '@/lib/db';

// "Samples": a ~1280px WebP of each post, stored on the CDN next to the
// original (Danbooru does the same). Post pages show the sample and load the
// full original only when the viewer asks for it. Samples are made once, in a
// slow background worker (lib/sampleWorker), never during a page request:
// resizing originals on demand is what overloaded the server before.

import { SAMPLE_MAX_HEIGHT, SAMPLE_MAX_WIDTH } from '@/lib/sampleSize';
export { SAMPLE_MAX_HEIGHT, SAMPLE_MAX_WIDTH };
// Originals already this small are shown as-is (no sample needed)
const SMALL_ENOUGH_BYTES = 600_000;

const QUEUE_KEY = 'samples:queue';
const QUEUED_SET = 'samples:queued';

export async function ensureSampleTable(): Promise<void> {
  await importQuery(
    `CREATE TABLE IF NOT EXISTS image_samples (
       image_id BIGINT PRIMARY KEY,
       url TEXT NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
}

/** The post's sample URL, or null (not made yet / table missing). Never throws. */
export async function sampleUrlFor(imageId: number): Promise<string | null> {
  const r = await query<{ url: string }>(`SELECT url FROM image_samples WHERE image_id = $1`, [imageId]).catch(() => null);
  return r?.rows[0]?.url ?? null;
}

/** Ask the worker to make this post's sample soon (viewed or new posts jump the backfill). */
export async function enqueueSample(imageId: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    // SADD returns 1 only the first time, so a post is queued once
    if ((await r.sadd(QUEUED_SET, String(imageId))) === 1) await r.lpush(QUEUE_KEY, String(imageId));
  } catch {
    // best effort: the backfill gets to it eventually
  }
}

export async function popQueuedSample(): Promise<number | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const id = await r.rpop(QUEUE_KEY);
    if (!id) return null;
    await r.srem(QUEUED_SET, id);
    return Number(id) || null;
  } catch {
    return null;
  }
}

export interface SampleSource {
  id: number;
  sequential_id: number;
  url: string;
  width: number;
  height: number;
  file_size: number;
  content_type: string | null;
}

/** Make, upload and record one post's sample. Returns the URL used for display. */
export async function generateSample(post: SampleSource): Promise<string> {
  const record = async (url: string) => {
    await importQuery(
      `INSERT INTO image_samples (image_id, url) VALUES ($1, $2)
       ON CONFLICT (image_id) DO UPDATE SET url = EXCLUDED.url, created_at = NOW()`,
      [post.id, url]
    );
    return url;
  };

  const animated = /gif|apng/i.test(post.content_type || '') || /\.gif(\?|$)/i.test(post.url);
  const small =
    post.width > 0 &&
    post.width <= SAMPLE_MAX_WIDTH &&
    post.height <= SAMPLE_MAX_HEIGHT &&
    post.file_size > 0 &&
    post.file_size <= SMALL_ENOUGH_BYTES;
  // Animated images keep their animation; small ones are already cheap to show
  if (animated || small) return record(post.url);

  const res = await fetch(post.url, { signal: AbortSignal.timeout(60_000) });
  if (res.status === 404 || res.status === 410) return record(post.url); // nothing to sample
  if (!res.ok) throw new Error(`original fetch ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());

  const sharp = (await import('sharp')).default;
  const output = await sharp(input, { failOn: 'none', sequentialRead: true })
    .rotate()
    .resize({ width: SAMPLE_MAX_WIDTH, height: SAMPLE_MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 3 })
    .toBuffer();

  // Not worth it if the sample isn't clearly smaller than the original
  if (post.file_size > 0 && output.length > post.file_size * 0.8) return record(post.url);

  const { uploadToB2 } = await import('@/lib/b2');
  const url = await uploadToB2(output, `sample-${post.sequential_id}.webp`, 'image/webp', 'samples');
  return record(url);
}

/** Cached count for the admin/health log. */
export async function sampleProgress(): Promise<string | null> {
  return cacheGet('samples:progress');
}
