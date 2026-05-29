import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { publicImageFilter, ratingFilter } from '@/lib/contentFilters';

// GET /api/v1/random - Get random image(s) with metadata
export async function GET(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['random:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const searchParams = request.nextUrl.searchParams;
    const count = Math.min(50, Math.max(1, parseInt(searchParams.get('count') || '1')));
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || [];
    const tagNames = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const excludeTags = searchParams.get('exclude_tags')?.split(',').filter(Boolean) || [];
    const minWidth = parseInt(searchParams.get('min_width') || '0');
    const minHeight = parseInt(searchParams.get('min_height') || '0');
    const maxWidth = parseInt(searchParams.get('max_width') || '0');
    const maxHeight = parseInt(searchParams.get('max_height') || '0');
    const aiOnly = searchParams.get('ai') === 'true';
    const noAi = searchParams.get('no_ai') === 'true';

    const whereClauses: string[] = [publicImageFilter()];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Filter by tags
    if (tagNames.length > 0) {
      const tagDocsResult = await query(
        `SELECT id FROM tags WHERE LOWER(name) = ANY($1)`,
        [tagNames.map(t => t.toLowerCase())]
      );
      if (tagDocsResult.rows.length === 0) {
        return apiResponse([], { message: 'No images match the specified tags' });
      }
      const tagIds = tagDocsResult.rows.map(r => r.id);
      
      const imageIdsRes = await query(
        `SELECT image_id FROM image_tags WHERE tag_id = ANY($1) GROUP BY image_id HAVING COUNT(DISTINCT tag_id) = $2`,
        [tagIds, tagIds.length]
      );
      if (imageIdsRes.rows.length === 0) {
        return apiResponse([], { message: 'No images match the specified tags' });
      }
      const matchingImageIds = imageIdsRes.rows.map(r => r.image_id);
      whereClauses.push(`i.id = ANY($${paramIndex})`);
      queryParams.push(matchingImageIds);
      paramIndex++;
    }

    // Exclude tags
    if (excludeTags.length > 0) {
      const excludeTagDocsResult = await query(
        `SELECT id FROM tags WHERE LOWER(name) = ANY($1)`,
        [excludeTags.map(t => t.toLowerCase())]
      );
      if (excludeTagDocsResult.rows.length > 0) {
        const excludeTagIds = excludeTagDocsResult.rows.map(r => r.id);
        const excludeImageIdsRes = await query(
          `SELECT DISTINCT image_id FROM image_tags WHERE tag_id = ANY($1)`,
          [excludeTagIds]
        );
        if (excludeImageIdsRes.rows.length > 0) {
          const excludeImageIds = excludeImageIdsRes.rows.map(r => r.image_id);
          whereClauses.push(`NOT (i.id = ANY($${paramIndex}))`);
          queryParams.push(excludeImageIds);
          paramIndex++;
        }
      }
    }

    // Ratings filter
    const rFilter = ratingFilter(ratings, paramIndex);
    if (rFilter) {
      whereClauses.push(`i.${rFilter.clause}`);
      queryParams.push(...rFilter.params);
      paramIndex += rFilter.params.length;
    }

    // Dimension filters
    if (minWidth > 0) {
      whereClauses.push(`i.width >= $${paramIndex}`);
      queryParams.push(minWidth);
      paramIndex++;
    }
    if (minHeight > 0) {
      whereClauses.push(`i.height >= $${paramIndex}`);
      queryParams.push(minHeight);
      paramIndex++;
    }
    if (maxWidth > 0) {
      whereClauses.push(`i.width <= $${paramIndex}`);
      queryParams.push(maxWidth);
      paramIndex++;
    }
    if (maxHeight > 0) {
      whereClauses.push(`i.height <= $${paramIndex}`);
      queryParams.push(maxHeight);
      paramIndex++;
    }

    // AI filters
    if (aiOnly) {
      whereClauses.push(`i.is_ai_generated = TRUE`);
    } else if (noAi) {
      whereClauses.push(`i.is_ai_generated = FALSE`);
    }

    // Query images
    const imagesResult = await query(
      `SELECT i.*, u.username as u_username
       FROM images i
       LEFT JOIN users u ON u.id = i.user_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY RANDOM()
       LIMIT $${paramIndex}`,
      [...queryParams, count]
    );

    const images = imagesResult.rows;

    if (images.length === 0) {
      return apiResponse([], { message: 'No images match the criteria' });
    }

    // Fetch tags in one batch
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

    // Format response
    const formattedImages = images.map((img) => ({
      id: String(img.id),
      dbid: String(img.id),
      post_id: img.sequential_id,
      url: img.url,
      thumbnail_url: img.thumbnail_url,
      width: img.width,
      height: img.height,
      file_size: img.file_size,
      content_type: img.content_type,
      rating: img.rating,
      is_ai_generated: img.is_ai_generated,
      source: img.source || null,
      description: img.description || null,
      tags: tagsByImage.get(img.id) || [],
      stats: {
        upvotes: img.upvotes || 0,
        downvotes: img.downvotes || 0,
        favorites: img.favorites || 0,
        views: img.views || 0,
      },
      user: {
        id: img.user_id || null,
        username: img.u_username || img.username || 'Anonymous',
      },
      created_at: img.created_at,
    }));

    const data = count === 1 ? formattedImages[0] : formattedImages;

    return apiResponse(data, {
      count: formattedImages.length,
      requested: count,
    });
  } catch (error) {
    console.error('API v1 random error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
