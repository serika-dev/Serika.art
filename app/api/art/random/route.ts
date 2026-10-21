import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { randomRows } from '@/lib/imageSearch';
import { swrCached } from '@/lib/swrCache';
import { NO_STORE_HEADERS } from '@/lib/cacheHeaders';

// GET /api/art/random – a random safe, hand-made, high-res post with a known
// artist, for the artwork pane on the login/contact/DMCA pages.
//
// Picked from a pool of POOL_SIZE posts that rotates every few hours rather than
// from all 3M posts: the resized versions of a pooled image are generated once
// and then served from Cloudflare's cache, instead of every visit resizing a
// brand-new multi-MB original. New pools are pre-warmed at the common widths.

interface Art {
  post_id: number;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  artist: string;
}

const POOL_SIZE = 40;
const SITE_URL = 'https://serika.art';
// Widths the browser picks for the art pane (next.config deviceSizes ≥ 1080)
const WARM_WIDTHS = [1080, 1200, 1536, 1920];

async function buildPool(): Promise<Art[]> {
  // 1. Candidates from a page sample, filtered on image columns only (cheap)
  const candidates = await randomRows<{ id: number; sequential_id: number; url: string; thumbnail_url: string; width: number; height: number }>({
    select: 'i.id, i.sequential_id, i.url, i.thumbnail_url, i.width, i.height',
    where: `i.deleted = FALSE AND i.unlisted = FALSE AND i.rating = 'safe' AND i.is_ai_generated = FALSE
      AND i.width >= 1200 AND i.height > 0
      AND (i.width::float / i.height::float) BETWEEN 0.9 AND 2.2`,
    params: [],
    limit: POOL_SIZE * 8,
    fullScanFallback: false,
  });
  if (candidates.length === 0) return [];

  // 2. Their artist tags by image id (index lookups only); keep posts with one
  const artists = await query<{ image_id: number; name: string }>(
    `SELECT DISTINCT ON (it.image_id) it.image_id, t.name
     FROM image_tags it JOIN tags t ON t.id = it.tag_id
     WHERE it.image_id = ANY($1::int[]) AND t.type = 'artist'
     ORDER BY it.image_id, t.count DESC`,
    [candidates.map((c) => c.id)]
  );
  const artistOf = new Map(artists.rows.map((r) => [r.image_id, r.name]));

  // Separate samples can return the same post twice
  const unique = Array.from(new Map(candidates.map((c) => [c.id, c])).values());
  const pool = unique
    .filter((c) => artistOf.has(c.id))
    .slice(0, POOL_SIZE)
    .map((c) => ({
      post_id: c.sequential_id,
      url: c.url,
      thumbnail_url: c.thumbnail_url,
      width: c.width,
      height: c.height,
      artist: artistOf.get(c.id)!.replace(/_/g, ' '),
    }));
  warm(pool).catch(() => {});
  return pool;
}

// Request each pooled image through the public optimizer URL once, so the
// origin and Cloudflare already hold the resized WebP when visitors arrive.
async function warm(pool: Art[]) {
  for (const art of pool) {
    for (const w of WARM_WIDTHS) {
      await fetch(`${SITE_URL}/_next/image?url=${encodeURIComponent(art.url)}&w=${w}&q=75`, {
        headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
        signal: AbortSignal.timeout(30000),
      })
        .then((r) => r.arrayBuffer())
        .catch(() => {});
    }
  }
}

export async function GET() {
  try {
    const pool = await swrCached('art:pool:v1', { freshSeconds: 6 * 3600, maxAgeSeconds: 2 * 86400 }, buildPool);
    const art = pool[Math.floor(Math.random() * pool.length)];
    if (!art) return NextResponse.json({ success: false }, { status: 404, headers: NO_STORE_HEADERS });
    return NextResponse.json({ success: true, ...art }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Random art error:', error);
    return NextResponse.json({ success: false }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
