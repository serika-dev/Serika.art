import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';

// POST /api/v1/batch/images - Get multiple images by IDs in a single request
export async function POST(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return apiError('ids must be a non-empty array', 400, 'INVALID_REQUEST');
    }

    if (ids.length > 100) {
      return apiError('Maximum 100 IDs per request', 400, 'TOO_MANY_IDS');
    }

    // Convert and validate IDs
    const parsedIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    if (parsedIds.length === 0) {
      return apiError('No valid IDs provided', 400, 'INVALID_IDS');
    }

    const imagesResult = await query(
      `SELECT i.*, u.username as u_username
       FROM images i
       LEFT JOIN users u ON u.id = i.user_id
       WHERE i.id = ANY($1)`,
      [parsedIds]
    );

    const images = imagesResult.rows;

    if (images.length === 0) {
      return apiResponse({ images: [], found: 0, requested: ids.length });
    }

    // Fetch tags for all matching images in a single batch
    const imageIds = images.map(img => img.id);
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

    const formattedImages = images.map((img) => ({
      id: String(img.id),
      dbid: String(img.id),
      post_id: img.sequential_id,
      sequential_id: img.sequential_id,
      url: img.url,
      thumbnail_url: img.thumbnail_url,
      width: img.width,
      height: img.height,
      file_size: img.file_size,
      content_type: img.content_type,
      rating: img.rating,
      is_ai_generated: img.is_ai_generated || false,
      source: img.source,
      description: img.description,
      tags: tagsByImage.get(img.id) || [],
      stats: {
        upvotes: img.upvotes || 0,
        downvotes: img.downvotes || 0,
        favorites: img.favorites || 0,
        views: img.views || 0,
      },
      user: img.user_id ? {
        id: img.user_id,
        username: img.u_username || img.username || 'Anonymous',
      } : null,
      created_at: img.created_at,
    }));

    // Return in the same order as requested
    const idOrder = new Map(ids.map((id, index) => [String(id), index]));
    formattedImages.sort((a, b) => {
      const orderA = idOrder.get(a.id) ?? 999;
      const orderB = idOrder.get(b.id) ?? 999;
      return orderA - orderB;
    });

    return apiResponse({
      images: formattedImages,
      found: formattedImages.length,
      requested: ids.length,
    });
  } catch (error) {
    console.error('API Error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
