import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { randomRows } from '@/lib/imageSearch';
import { NO_STORE_HEADERS } from '@/lib/cacheHeaders';

// GET /api/art/random – one random safe, hand-made, high-res post with a known
// artist, for the artwork pane on the login/contact/DMCA pages.
export async function GET() {
  try {
    const rows = await randomRows<{ id: number; sequential_id: number; url: string; thumbnail_url: string; width: number; height: number }>({
      select: 'i.id, i.sequential_id, i.url, i.thumbnail_url, i.width, i.height',
      where: `i.deleted = FALSE AND i.unlisted = FALSE AND i.rating = 'safe' AND i.is_ai_generated = FALSE
        AND i.width >= 1200 AND i.height > 0
        AND (i.width::float / i.height::float) BETWEEN 0.9 AND 2.2
        AND EXISTS (SELECT 1 FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE it.image_id = i.id AND t.type = 'artist')`,
      params: [],
      limit: 1,
    });
    const post = rows[0];
    if (!post) return NextResponse.json({ success: false }, { status: 404, headers: NO_STORE_HEADERS });

    const artist = await query<{ name: string }>(
      `SELECT t.name FROM image_tags it JOIN tags t ON t.id = it.tag_id
       WHERE it.image_id = $1 AND t.type = 'artist' ORDER BY t.count DESC LIMIT 1`,
      [post.id]
    );

    return NextResponse.json(
      {
        success: true,
        post_id: post.sequential_id,
        url: post.url,
        thumbnail_url: post.thumbnail_url,
        width: post.width,
        height: post.height,
        artist: (artist.rows[0]?.name || 'Unknown artist').replace(/_/g, ' '),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('Random art error:', error);
    return NextResponse.json({ success: false }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
