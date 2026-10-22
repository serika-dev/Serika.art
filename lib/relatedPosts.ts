import { withTransaction } from '@/lib/db';
import { resolveTags } from '@/lib/imageSearch';
import { swrCached } from '@/lib/swrCache';

// The "More by this artist / of this character" strips under every post.
// Google crawls thousands of posts, so this has to be close to free:
//  - one backwards walk of image_tags(tag_id, image_id) – newest first, no
//    sort and no COUNT (the total comes from tags.count);
//  - a hard 2 s statement_timeout, so a slow tag can never sit on a pool
//    connection for long;
//  - cached per tag in Redis and shared by every post carrying that tag.
// The earlier version ran two `sort=popular` searches with a full COUNT per
// post view; under crawl load that exhausted the DB pool and took the site down.

export interface RelatedThumb {
  sequentialId: number;
  thumbnailUrl: string;
  tags: { name: string; type: string }[];
}

export interface RelatedSet {
  tag: string;
  total: number;
  images: RelatedThumb[];
}

const PER_TAG = 25; // enough for the 24-wide artist grid plus the current post

async function loadRelated(tagId: number, safeOnly: boolean): Promise<RelatedThumb[]> {
  return withTransaction(async (client) => {
    await client.query(`SET LOCAL statement_timeout = '2000ms'`);
    const rows = (
      await client.query(
        `SELECT i.id, i.sequential_id, COALESCE(i.thumbnail_url, i.url) AS thumb
         FROM image_tags it
         JOIN images i ON i.id = it.image_id
         WHERE it.tag_id = $1
           AND i.deleted = FALSE AND i.unlisted = FALSE
           ${safeOnly ? `AND i.rating = 'safe'` : ''}
         ORDER BY it.image_id DESC
         LIMIT ${PER_TAG}`,
        [tagId]
      )
    ).rows;
    if (rows.length === 0) return [];

    // Character/series/artist names for the alt text
    const tagRows = (
      await client.query(
        `SELECT it.image_id, t.name, t.type
         FROM image_tags it JOIN tags t ON t.id = it.tag_id
         WHERE it.image_id = ANY($1::int[]) AND t.type IN ('artist', 'character', 'copyright')`,
        [rows.map((r) => r.id)]
      )
    ).rows;
    const byImage = new Map<number, { name: string; type: string }[]>();
    for (const t of tagRows) {
      const list = byImage.get(t.image_id) || [];
      list.push({ name: t.name, type: t.type });
      byImage.set(t.image_id, list);
    }
    return rows.map((r) => ({ sequentialId: r.sequential_id, thumbnailUrl: r.thumb, tags: byImage.get(r.id) || [] }));
  });
}

/** Newest posts with `tag` (safe-only if asked). Never throws: null when unknown or slow. */
export async function relatedForTag(tag: string, safeOnly: boolean): Promise<RelatedSet | null> {
  const work = (async () => {
    const { found } = await resolveTags([tag]);
    const ref = found[0];
    if (!ref) return null;
    const images = await swrCached(
      `related:v2:${ref.id}:${safeOnly ? 's' : 'a'}`,
      { freshSeconds: 3600, maxAgeSeconds: 86400 },
      () => loadRelated(ref.id, safeOnly)
    );
    return { tag: ref.name, total: ref.count, images };
  })().catch(() => null);

  // The post itself must never wait on this
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
  return Promise.race([work, timeout]);
}
