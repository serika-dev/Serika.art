import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { publicImageFilter } from '@/lib/contentFilters';

// GET /api/v1/tags/[name] - Get tag details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const validation = await validateApiKey(request, ['tags:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const { name } = await params;
    const tagName = name.toLowerCase().trim();

    const tagResult = await query(`SELECT * FROM tags WHERE name = $1`, [tagName]);

    if (tagResult.rows.length === 0) {
      return apiError('Tag not found', 404, 'NOT_FOUND');
    }

    const tag = tagResult.rows[0];

    // Get sample images with this tag
    const sampleImagesResult = await query(
      `SELECT i.id, i.thumbnail_url, i.url, i.rating
       FROM images i
       JOIN image_tags it ON it.image_id = i.id
       WHERE it.tag_id = $1 AND i.rating = 'safe' AND i.${publicImageFilter()}
       ORDER BY i.upvotes DESC
       LIMIT 5`,
      [tag.id]
    );

    // Get actual count
    const actualCountResult = await query(
      `SELECT COUNT(*)
       FROM image_tags it
       JOIN images i ON i.id = it.image_id
       WHERE it.tag_id = $1 AND i.${publicImageFilter()}`,
      [tag.id]
    );
    const actualCount = parseInt(actualCountResult.rows[0].count, 10);

    const formattedTag = {
      id: String(tag.id),
      name: tag.name,
      type: tag.type,
      count: actualCount,
      created_at: tag.created_at,
      sample_images: sampleImagesResult.rows.map((img) => ({
        id: String(img.id),
        thumbnail_url: img.thumbnail_url || img.url,
        rating: img.rating,
      })),
    };

    return apiResponse(formattedTag);
  } catch (error) {
    console.error('API v1 tag detail error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
