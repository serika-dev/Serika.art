import { NextRequest } from 'next/server';
import { query as dbQuery } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { publicImageFilter, ratingFilter } from '@/lib/contentFilters';

// GET /api/v1/images - List images with pagination and filters
export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const tagNames = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || [];
    const sort = searchParams.get('sort') || 'newest';
    const aiOnly = searchParams.get('ai') === 'true';
    const search = searchParams.get('q') || '';
    const userId = searchParams.get('user_id');
    const minWidth = parseInt(searchParams.get('min_width') || '0');
    const minHeight = parseInt(searchParams.get('min_height') || '0');

    const skip = (page - 1) * limit;

    // Build query
    const whereClauses: string[] = [publicImageFilter()];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (userId) {
      whereClauses.push(`i.user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    }

    // Resolve tag names to IDs
    if (tagNames.length > 0) {
      const tagDocsResult = await dbQuery(
        `SELECT id FROM tags WHERE LOWER(name) = ANY($1)`,
        [tagNames.map((t) => t.toLowerCase())]
      );
      if (tagDocsResult.rows.length === 0) {
        return apiResponse([], {
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }
      const tagIds = tagDocsResult.rows.map((t) => t.id);

      const imageIdsRes = await dbQuery(
        `SELECT image_id FROM image_tags WHERE tag_id = ANY($1) GROUP BY image_id HAVING COUNT(DISTINCT tag_id) = $2`,
        [tagIds, tagIds.length]
      );
      if (imageIdsRes.rows.length === 0) {
        return apiResponse([], {
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }
      const matchingImageIds = imageIdsRes.rows.map(r => r.image_id);
      whereClauses.push(`i.id = ANY($${paramIndex})`);
      queryParams.push(matchingImageIds);
      paramIndex++;
    }

    const rFilter = ratingFilter(ratings, paramIndex);
    if (rFilter) {
      whereClauses.push(`i.${rFilter.clause}`);
      queryParams.push(...rFilter.params);
      paramIndex += rFilter.params.length;
    }

    if (aiOnly) {
      whereClauses.push(`i.is_ai_generated = TRUE`);
    }

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

    if (search) {
      const searchPattern = `%${search}%`;
      const searchParamIdx = paramIndex;
      paramIndex++;
      
      whereClauses.push(
        `(i.id IN (SELECT image_id FROM image_tags WHERE tag_id IN (SELECT id FROM tags WHERE name ILIKE $${searchParamIdx}))
          OR i.description ILIKE $${searchParamIdx}
          OR i.username ILIKE $${searchParamIdx})`
      );
      queryParams.push(searchPattern);
    }

    // Determine sort
    let sortClause = 'i.created_at DESC';
    if (sort === 'popular') {
      sortClause = 'i.upvotes DESC, i.views DESC';
    } else if (sort === 'favorites') {
      sortClause = 'i.favorites DESC';
    } else if (sort === 'views') {
      sortClause = 'i.views DESC';
    } else if (sort === 'oldest') {
      sortClause = 'i.created_at ASC';
    } else if (sort === 'random') {
      sortClause = 'RANDOM()';
    }

    // Get count and results
    const countResult = await dbQuery(
      `SELECT COUNT(*) as count FROM images i WHERE ${whereClauses.join(' AND ')}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const imagesResult = await dbQuery(
      `SELECT i.*, u.username as u_username
       FROM images i
       LEFT JOIN users u ON u.id = i.user_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY ${sortClause}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, skip]
    );

    const images = imagesResult.rows;

    if (images.length === 0) {
      return apiResponse([], {
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }

    // Fetch tags in one batch
    const imageIds = images.map(img => img.id);
    const tagsResult = await dbQuery(
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
      updated_at: img.updated_at,
    }));

    return apiResponse(formattedImages, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        has_next: page < Math.ceil(total / limit),
        has_prev: page > 1,
      },
    });
  } catch (error) {
    console.error('API v1 images error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
