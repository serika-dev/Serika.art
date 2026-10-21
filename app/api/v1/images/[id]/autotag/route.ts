import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { autotagImage, AutotaggerUnavailableError, UnreadableImageError } from '@/lib/autotagger';
import { applySuggestedTags, sameTagKey } from '@/lib/autotagApply';
import { revalidateImagePage } from '@/lib/revalidate';

// POST /api/v1/images/:id/autotag - Predict tags for an existing post.
// With ?apply=true (or JSON {"apply": true}) the confident predictions the post
// lacks are added to it; that needs `images:write` and the key's owner must be
// the uploader or a moderator. Tags are only ever added, never removed.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const apply = request.nextUrl.searchParams.get('apply') === 'true' || body?.apply === true;

    const validation = await validateApiKey(request, apply ? ['images:write'] : ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const { id } = await params;
    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) return apiError('Invalid image ID', 400, 'INVALID_ID');

    const img = await query(
      `SELECT id, sequential_id, user_id, url FROM images
       WHERE sequential_id = $1 AND deleted = FALSE AND unlisted = FALSE`,
      [sequentialId]
    );
    if (img.rows.length === 0) return apiError('Image not found', 404, 'NOT_FOUND');
    const image = img.rows[0];

    if (apply) {
      const keyUser = validation.apiKey!.user_id;
      if (image.user_id !== keyUser) {
        const rank = (await query(`SELECT rank FROM users WHERE id = $1`, [keyUser])).rows[0]?.rank;
        if (!['moderator', 'admin', 'owner'].includes(rank)) {
          return apiError('Only the uploader or a moderator can apply tags to this post', 403, 'FORBIDDEN');
        }
      }
    }

    const res = await fetch(image.url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return apiError('Could not download the image', 502, 'FETCH_FAILED');
    const prediction = await autotagImage(Buffer.from(await res.arrayBuffer()));

    const current = await query(
      `SELECT t.name FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE it.image_id = $1`,
      [image.id]
    );
    const have = new Set(current.rows.map((r) => sameTagKey(r.name)));
    const missing = prediction.tags.filter((t) => t.recommended && !have.has(sameTagKey(t.name))).map((t) => t.name);

    let added: string[] = [];
    if (apply) {
      added = await applySuggestedTags(image.id, prediction.tags);
      if (added.length) revalidateImagePage(image.sequential_id);
    }

    return apiResponse({
      post_id: image.sequential_id,
      tags: prediction.tags,
      rating: prediction.rating,
      missing_tags: missing,
      applied: apply,
      added_tags: added,
    });
  } catch (error) {
    if (error instanceof AutotaggerUnavailableError) return apiError('Autotagger is unavailable', 503, 'AUTOTAGGER_UNAVAILABLE');
    if (error instanceof UnreadableImageError) return apiError('The autotagger could not read this image', 422, 'INVALID_IMAGE');
    console.error('API v1 image autotag error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
