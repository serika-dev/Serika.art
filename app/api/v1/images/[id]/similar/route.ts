import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';

// GET /api/v1/similar/:id - Get similar images based on tags
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));

    const imageId = parseInt(id, 10);
    if (isNaN(imageId)) {
      return apiError('Invalid image ID format', 400, 'INVALID_ID');
    }

    // Find the source image to check existence and rating
    const sourceImageResult = await query(
      `SELECT rating FROM images WHERE id = $1 AND deleted = FALSE AND unlisted = FALSE`,
      [imageId]
    );

    if (sourceImageResult.rows.length === 0) {
      return apiError('Image not found', 404, 'NOT_FOUND');
    }

    const sourceImage = sourceImageResult.rows[0];

    // Find similar images using standard relational JOIN
    const similarResult = await query(
      `SELECT i.*, COUNT(it2.tag_id) as shared_tags
       FROM image_tags it1
       JOIN image_tags it2 ON it2.tag_id = it1.tag_id
       JOIN images i ON i.id = it2.image_id
       WHERE it1.image_id = $1 AND it2.image_id != $1
         AND i.deleted = FALSE AND i.unlisted = FALSE AND i.rating = $2
       GROUP BY i.id
       ORDER BY shared_tags DESC, i.upvotes DESC
       LIMIT $3`,
      [imageId, sourceImage.rating, limit]
    );

    const similarImages = similarResult.rows;

    if (similarImages.length === 0) {
      return apiResponse({
        source_id: id,
        similar: [],
        count: 0,
      });
    }

    // Fetch tags in one batch
    const imageIds = similarImages.map(img => img.id);
    const tagsResult = await query(
      `SELECT it.image_id, t.name, t.type
       FROM image_tags it
       JOIN tags t ON t.id = it.tag_id
       WHERE it.image_id = ANY($1)`,
      [imageIds]
    );

    const tagsByImage = new Map<number, any[]>();
    for (const row of tagsResult.rows) {
      const list = tagsByImage.get(row.image_id) || [];
      list.push({ name: row.name, type: row.type });
      tagsByImage.set(row.image_id, list);
    }

    const formattedImages = similarImages.map((img) => ({
      id: String(img.id),
      dbid: String(img.id),
      post_id: img.sequential_id,
      sequential_id: img.sequential_id,
      url: img.url,
      thumbnail_url: img.thumbnail_url,
      width: img.width,
      height: img.height,
      rating: img.rating,
      is_ai_generated: img.is_ai_generated || false,
      shared_tags: parseInt(img.shared_tags, 10),
      tags: (tagsByImage.get(img.id) || []).slice(0, 10),
      stats: {
        upvotes: img.upvotes || 0,
        downvotes: img.downvotes || 0,
        favorites: img.favorites || 0,
        views: img.views || 0,
      },
    }));

    return apiResponse({
      source_id: id,
      similar: formattedImages,
      count: formattedImages.length,
    });
  } catch (error) {
    console.error('API Error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
