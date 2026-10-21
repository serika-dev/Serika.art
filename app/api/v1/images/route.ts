import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { query as dbQuery } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { publicImageFilter, ratingFilter } from '@/lib/contentFilters';
import {
  SqlParams, TagRef, resolveTags, hasAllTagsSql, textSearchSql,
  randomRows, cachedCount, approximateImageCount,
} from '@/lib/imageSearch';

// Everything the response uses – skips the metadata JSONB and moderation columns
const V1_COLUMNS = `i.id, i.sequential_id, i.user_id, i.username, i.url, i.thumbnail_url,
  i.width, i.height, i.file_size, i.content_type, i.rating, i.is_ai_generated,
  i.source, i.description, i.upvotes, i.downvotes, i.favorites, i.views,
  i.created_at, i.updated_at`;

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
    const sql = new SqlParams();
    const whereClauses: string[] = [publicImageFilter()];

    if (userId) {
      whereClauses.push(`i.user_id = ${sql.add(userId)}`);
    }

    // Resolve tag names to IDs; every tag becomes an indexed EXISTS probe
    let tagRefs: TagRef[] = [];
    if (tagNames.length > 0) {
      const { found, missing } = await resolveTags(tagNames);
      if (found.length === 0) {
        return apiResponse([], {
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }
      if (missing.length > 0) {
        return apiError('One or more specified tags were not found', 404, 'TAG_NOT_FOUND');
      }
      tagRefs = found;
      whereClauses.push(...hasAllTagsSql('i', found, sql));
    }

    const rFilter = ratingFilter(ratings, sql.next);
    if (rFilter) {
      whereClauses.push(`i.${rFilter.clause}`);
      sql.values.push(...rFilter.params);
    }

    if (aiOnly) {
      whereClauses.push(`i.is_ai_generated = TRUE`);
    }

    if (minWidth > 0) {
      whereClauses.push(`i.width >= ${sql.add(minWidth)}`);
    }

    if (minHeight > 0) {
      whereClauses.push(`i.height >= ${sql.add(minHeight)}`);
    }

    if (search) {
      whereClauses.push(await textSearchSql('i', search, sql));
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
    }

    const where = whereClauses.join(' AND ');
    const queryParams = sql.values;

    // Broad listings answer with an estimate while the exact count is cached in the background
    let estimate: number | null = null;
    if (!search && !userId && !minWidth && !minHeight) {
      estimate = tagRefs.length > 0 ? Math.min(...tagRefs.map((t) => t.count)) : await approximateImageCount();
    }

    // Get count and results in parallel
    const [{ total }, rows] = await Promise.all([
      cachedCount(
        `count:v1images:${createHash('sha1').update(where + JSON.stringify(queryParams)).digest('hex')}`,
        `SELECT COUNT(*) as count FROM images i WHERE ${where}`,
        queryParams,
        { estimate }
      ),
      sort === 'random'
        ? randomRows({
            select: `${V1_COLUMNS}, u.username as u_username`,
            joins: 'LEFT JOIN users u ON u.id = i.user_id',
            where,
            params: queryParams,
            limit,
          })
        : dbQuery(
            `SELECT ${V1_COLUMNS}, u.username as u_username
             FROM images i
             LEFT JOIN users u ON u.id = i.user_id
             WHERE ${where}
             ORDER BY ${sortClause}
             LIMIT $${sql.next} OFFSET $${sql.next + 1}`,
            [...queryParams, limit, skip]
          ).then((r) => r.rows),
    ]);
    const imagesResult = { rows };

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
