import { createHash } from 'crypto';
import { query, cacheGet, cacheGetMany, cacheSet } from '@/lib/db';
import { publicImageFilter, ratingFilter } from '@/lib/contentFilters';

// Shared, index-friendly building blocks for image listings.
//
// The old listing SQL resolved tag filters with
//   i.id IN (SELECT image_id FROM image_tags WHERE tag_id = ANY(..)
//            GROUP BY image_id HAVING COUNT(DISTINCT tag_id) = N)
// which aggregates every row of every requested tag before it can return a
// single image – for a tag like "1girl" (~1M rows) that ran into the 45s
// statement_timeout. One EXISTS probe per tag lets Postgres walk the
// created_at / popularity index and stop after LIMIT rows for common tags,
// or start from image_tags for rare ones.

/** Collects positional parameters so callers never juggle $n indexes. */
export class SqlParams {
  values: any[] = [];
  add(value: any): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
  get next(): number {
    return this.values.length + 1;
  }
}

export interface TagRef {
  id: number;
  name: string;
  count: number;
}

const TAG_REF_TTL = 300;

function tagNameVariants(name: string): string[] {
  // Older tags are stored with spaces ("long hair"), newer imports with
  // underscores ("long_hair") – accept either spelling, exact match first.
  return Array.from(new Set([name, name.replace(/_/g, ' '), name.replace(/ /g, '_')]));
}

/** Resolve tag names to ids (with counts) – Redis-cached, one MGET + at most one query. */
export async function resolveTags(names: string[]): Promise<{ found: TagRef[]; missing: string[] }> {
  const inputs = Array.from(new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean)));
  if (inputs.length === 0) return { found: [], missing: [] };

  const cached = await cacheGetMany(inputs.map((n) => `tagref:${n}`));
  const found: TagRef[] = [];
  const uncached: string[] = [];
  inputs.forEach((name, i) => {
    const hit = cached[i];
    if (hit) {
      try {
        found.push(JSON.parse(hit));
        return;
      } catch {
        // corrupt entry – refetch
      }
    }
    uncached.push(name);
  });

  const missing: string[] = [];
  if (uncached.length > 0) {
    const result = await query<{ id: number; name: string; count: number }>(
      `SELECT id, name, count FROM tags WHERE name = ANY($1::text[])`,
      [uncached.flatMap(tagNameVariants)]
    );
    const byName = new Map(result.rows.map((row) => [row.name, row]));
    for (const name of uncached) {
      const row = tagNameVariants(name).map((v) => byName.get(v)).find(Boolean);
      if (!row) {
        missing.push(name);
        continue;
      }
      const ref: TagRef = { id: row.id, name: row.name, count: row.count };
      found.push(ref);
      cacheSet(`tagref:${name}`, JSON.stringify(ref), TAG_REF_TTL).catch(() => {});
    }
  }

  // "long_hair" and "long hair" resolve to the same tag – keep one.
  const unique = Array.from(new Map(found.map((t) => [t.id, t])).values());
  return { found: unique, missing };
}

/** One EXISTS probe per tag: the image must carry every tag. Rarest tag first. */
export function hasAllTagsSql(alias: string, tags: TagRef[], p: SqlParams): string[] {
  return [...tags]
    .sort((a, b) => a.count - b.count)
    .map(
      (t) =>
        `EXISTS (SELECT 1 FROM image_tags it WHERE it.image_id = ${alias}.id AND it.tag_id = ${p.add(t.id)})`
    );
}

/**
 * Postgres tends to walk the sort index (created_at, upvotes…) and probe
 * image_tags for every row even when a tag is rare – fine for "1girl", but
 * for a tag on 200 posts it scans most of the table. We know each tag's post
 * count, so decide here: walking needs ~(offset+limit) * total / count rows,
 * starting from the tag needs ~count rows. Returns the tag to start from, or
 * null to walk the index.
 */
export function pickDrivingTag(tags: TagRef[], offset: number, limit: number, totalImages: number): TagRef | null {
  if (tags.length === 0) return null;
  const rarest = tags.reduce((a, b) => (b.count < a.count ? b : a));
  const walkRows = ((offset + limit) * Math.max(totalImages, 1)) / Math.max(rarest.count, 1);
  // A walked row costs more than a driven one (heap filter + probe per row)
  return rarest.count < walkRows * 4 ? rarest : null;
}

/** CTE + join that makes the query start from one tag's rows. */
export function drivingTagSql(alias: string, tag: TagRef, p: SqlParams): { cte: string; join: string } {
  return {
    cte: `WITH driver AS MATERIALIZED (SELECT image_id FROM image_tags WHERE tag_id = ${p.add(tag.id)})`,
    join: `JOIN driver ON driver.image_id = ${alias}.id`,
  };
}

/** The image must carry none of the tags. */
export function hasNoTagsSql(alias: string, tags: TagRef[], p: SqlParams): string | null {
  if (tags.length === 0) return null;
  return `NOT EXISTS (SELECT 1 FROM image_tags it WHERE it.image_id = ${alias}.id AND it.tag_id = ANY(${p.add(
    tags.map((t) => t.id)
  )}::int[]))`;
}

/** Free-text search over tags, description and uploader. */
export async function textSearchSql(alias: string, search: string, p: SqlParams): Promise<string> {
  const pattern = p.add(`%${search}%`);
  // Resolve matching tags up front (trigram index on tags.name) so the image
  // side is a cheap probe instead of a join against every tag row.
  const tagRows = await query<{ id: number }>(
    `SELECT id FROM tags WHERE name ILIKE $1 ORDER BY count DESC LIMIT 50`,
    [`%${search}%`]
  );
  const tagClause = tagRows.rows.length
    ? ` OR EXISTS (SELECT 1 FROM image_tags it WHERE it.image_id = ${alias}.id AND it.tag_id = ANY(${p.add(
        tagRows.rows.map((r) => r.id)
      )}::int[]))`
    : '';
  return `(${alias}.description ILIKE ${pattern} OR ${alias}.username ILIKE ${pattern}${tagClause})`;
}

/**
 * Random rows without sorting the whole filtered table. Samples ~1% of the
 * table's pages first; only when that is too sparse (a rare filter, so the
 * matching set is small anyway) does it fall back to ORDER BY RANDOM().
 */
export async function randomRows<T extends Record<string, any> = any>(
  { select, from = 'images i', joins = '', where, params, limit }: {
    select: string;
    from?: string;
    joins?: string;
    where: string;
    params: any[];
    limit: number;
  }
): Promise<T[]> {
  const n = params.length + 1;
  const sampled = await query<T>(
    `SELECT ${select} FROM ${from} TABLESAMPLE SYSTEM (1) ${joins}
     WHERE ${where} ORDER BY RANDOM() LIMIT $${n}`,
    [...params, limit]
  );
  if (sampled.rows.length >= limit) return sampled.rows;

  const full = await query<T>(
    `SELECT ${select} FROM ${from} ${joins}
     WHERE ${where} ORDER BY RANDOM() LIMIT $${n}`,
    [...params, limit]
  );
  return full.rows;
}

// ── Counts ──────────────────────────────────────────────────────────

const inflightCounts = new Map<string, Promise<number>>();

/**
 * COUNT(*) is the slowest part of a listing on 1.5M+ rows. Serve it from
 * cache; on a miss, give the real count a short budget and otherwise answer
 * with `estimate` while the exact count finishes in the background and lands
 * in the cache for the next request.
 */
export async function cachedCount(
  cacheKey: string,
  sql: string,
  params: any[],
  { ttl = 600, estimate = null, budgetMs = 300 }: { ttl?: number; estimate?: number | null; budgetMs?: number } = {}
): Promise<{ total: number; estimated: boolean }> {
  const cached = await cacheGet(cacheKey);
  if (cached !== null) return { total: parseInt(cached, 10), estimated: false };

  let pending = inflightCounts.get(cacheKey);
  if (!pending) {
    pending = query(sql, params)
      .then(async (res) => {
        const count = parseInt(res.rows[0]?.count ?? '0', 10);
        await cacheSet(cacheKey, String(count), ttl);
        return count;
      })
      .finally(() => inflightCounts.delete(cacheKey));
    inflightCounts.set(cacheKey, pending);
  }

  if (estimate === null) return { total: await pending, estimated: false };

  pending.catch(() => {}); // the background run must never surface as unhandled
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs));
  const total = await Promise.race([pending, timeout]);
  return total === null ? { total: estimate, estimated: true } : { total, estimated: false };
}

/** Planner row estimate for the images table – instant, refreshed hourly. */
export async function approximateImageCount(): Promise<number> {
  const cached = await cacheGet('count:images:approx');
  if (cached !== null) return parseInt(cached, 10);
  const res = await query(`SELECT GREATEST(reltuples, 0)::bigint AS count FROM pg_class WHERE oid = 'images'::regclass`);
  const count = parseInt(res.rows[0]?.count ?? '0', 10);
  await cacheSet('count:images:approx', String(count), 3600);
  return count;
}

/** Attach tags to a page of images in one query. */
export async function tagsForImages(imageIds: number[]): Promise<Map<number, { id: number; name: string; type: string; count: number }[]>> {
  const byImage = new Map<number, { id: number; name: string; type: string; count: number }[]>();
  if (imageIds.length === 0) return byImage;
  const res = await query(
    `SELECT it.image_id, t.id, t.name, t.type, t.count
     FROM image_tags it
     JOIN tags t ON t.id = it.tag_id
     WHERE it.image_id = ANY($1::int[])`,
    [imageIds]
  );
  for (const row of res.rows) {
    const list = byImage.get(row.image_id) || [];
    list.push({ id: row.id, name: row.name, type: row.type, count: row.count });
    byImage.set(row.image_id, list);
  }
  return byImage;
}

// ── Site listing (/api/images and the server-rendered /posts) ───────

export interface ImageListParams {
  page: number;
  limit: number;
  tags: string[];
  ratings: string[];
  sort: string;
  aiOnly: boolean;
  hideAI: boolean;
  q: string;
  userId: string | null;
  username: string | null;
}

type ParamSource = { get(name: string): string | null };

export function parseImageListParams(sp: ParamSource): ImageListParams {
  const list = (name: string) => sp.get(name)?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  return {
    page: Math.max(1, parseInt(sp.get('page') || '1', 10) || 1),
    limit: Math.min(Math.max(parseInt(sp.get('limit') || '24', 10) || 24, 1), 100),
    tags: list('tags'),
    ratings: list('ratings'),
    sort: sp.get('sort') || 'newest',
    aiOnly: sp.get('ai') === 'true',
    hideAI: sp.get('hideAI') === 'true',
    q: sp.get('q') || '',
    userId: sp.get('userId'),
    username: sp.get('username'),
  };
}

const ORDER_BY: Record<string, string> = {
  newest: 'i.created_at DESC',
  popular: 'i.upvotes DESC, i.views DESC',
  favorites: 'i.favorites DESC',
  views: 'i.views DESC',
  oldest: 'i.created_at ASC',
  filesize: 'i.file_size DESC',
  'filesize-asc': 'i.file_size ASC',
  resolution: 'i.width DESC, i.height DESC',
  aspectratio: 'i.width DESC',
  alphabetical: 'i.username ASC, i.created_at DESC',
  'alphabetical-reverse': 'i.username DESC, i.created_at DESC',
};

const LIST_COLUMNS = `i.id, i.sequential_id, i.user_id, i.username, i.url, i.thumbnail_url,
  i.width, i.height, i.file_size, i.rating, i.is_ai_generated,
  i.upvotes, i.downvotes, i.favorites, i.views, i.created_at`;

const LIST_CACHE_TTL = 20;

export type ImageListResult =
  | {
      success: true;
      images: any[];
      pagination: { page: number; limit: number; total: number; pages: number; has_next: boolean; estimated?: boolean };
    }
  | { success: false; error: string; code: string; status: number };

function emptyList(p: ImageListParams): ImageListResult {
  return { success: true, images: [], pagination: { page: p.page, limit: p.limit, total: 0, pages: 0, has_next: false } };
}

export async function listImages(p: ImageListParams): Promise<ImageListResult> {
  const isRandom = p.sort === 'random';
  const listKey = `imglist:${createHash('sha1').update(JSON.stringify(p)).digest('hex')}`;
  if (!isRandom) {
    const hit = await cacheGet(listKey);
    if (hit) {
      try {
        return JSON.parse(hit);
      } catch {
        // fall through
      }
    }
  }

  const sql = new SqlParams();
  const conditions: string[] = [publicImageFilter()];

  if (p.username) {
    conditions.push(`LOWER(i.username) = LOWER(${sql.add(p.username)})`);
  } else if (p.userId) {
    conditions.push(p.userId === 'null' ? `i.user_id IS NULL` : `i.user_id = ${sql.add(p.userId)}`);
  }

  let tags: TagRef[] = [];
  if (p.tags.length > 0) {
    const resolved = await resolveTags(p.tags);
    if (resolved.found.length === 0) return emptyList(p);
    if (resolved.missing.length > 0) {
      return { success: false, error: 'One or more specified tags were not found', code: 'TAG_NOT_FOUND', status: 404 };
    }
    tags = resolved.found;
  }

  const rf = ratingFilter(p.ratings, sql.next);
  if (rf) {
    conditions.push(`i.${rf.clause}`);
    sql.values.push(...rf.params);
  }

  if (p.aiOnly) conditions.push(`i.is_ai_generated = TRUE`);
  if (p.hideAI) conditions.push(`i.is_ai_generated = FALSE`);
  if (p.q) conditions.push(await textSearchSql('i', p.q, sql));

  const offset = (p.page - 1) * p.limit;
  const totalImages = await approximateImageCount();

  // The count always uses EXISTS probes (the planner handles those well
  // without ORDER BY/LIMIT); the page query may start from a rare tag instead.
  const countParams = new SqlParams();
  countParams.values = [...sql.values];
  const countWhere = [...conditions, ...hasAllTagsSql('i', tags, countParams)].join(' AND ');

  const driving = isRandom ? null : pickDrivingTag(tags, offset, p.limit, totalImages);
  const listParams = new SqlParams();
  listParams.values = [...sql.values];
  const drive = driving ? drivingTagSql('i', driving, listParams) : null;
  const listWhere = [
    ...conditions,
    ...hasAllTagsSql('i', tags.filter((t) => t !== driving), listParams),
  ].join(' AND ');

  // Fast estimate for broad listings; user/search listings are cheap or
  // unpredictable, so those wait for the exact count.
  let estimate: number | null = null;
  if (!p.q && !p.username && !p.userId) {
    estimate = tags.length > 0 ? Math.min(...tags.map((t) => t.count)) : totalImages;
  }

  const [rows, count] = await Promise.all([
    isRandom
      ? randomRows({ select: LIST_COLUMNS, where: countWhere, params: countParams.values, limit: p.limit })
      : query(
          `${drive?.cte ?? ''}
           SELECT ${LIST_COLUMNS} FROM images i ${drive?.join ?? ''}
           WHERE ${listWhere}
           ORDER BY ${ORDER_BY[p.sort] || ORDER_BY.newest}
           LIMIT $${listParams.next} OFFSET $${listParams.next + 1}`,
          [...listParams.values, p.limit, offset]
        ).then((r) => r.rows),
    cachedCount(
      `count:images:${createHash('sha1').update(countWhere + JSON.stringify(countParams.values)).digest('hex')}`,
      `SELECT COUNT(*) AS count FROM images i WHERE ${countWhere}`,
      countParams.values,
      { estimate }
    ),
  ]);

  const tagsByImage = await tagsForImages(rows.map((r) => r.id));
  const images = rows.map((img) => {
    const imageTags = (tagsByImage.get(img.id) || []).map((t) => ({ _id: t.id, ...t }));
    return {
      ...img,
      tags: imageTags,
      dbid: String(img.id),
      post_id: img.sequential_id,
      _id: String(img.id),
      // camelCase compatibility fields for React components
      sequentialId: img.sequential_id,
      userId: img.user_id,
      thumbnailUrl: img.thumbnail_url,
      isAIGenerated: img.is_ai_generated,
      fileSize: img.file_size,
      createdAt: img.created_at,
    };
  });

  const total = count.total;
  const pages = Math.ceil(total / p.limit);
  const result: ImageListResult = {
    success: true,
    images,
    pagination: {
      page: p.page,
      limit: p.limit,
      total,
      pages,
      has_next: p.page < pages,
      ...(count.estimated && { estimated: true }),
    },
  };

  if (!isRandom) {
    // An estimated total is only kept briefly so the exact one replaces it soon.
    cacheSet(listKey, JSON.stringify(result), count.estimated ? 5 : LIST_CACHE_TTL).catch(() => {});
  }
  return result;
}
