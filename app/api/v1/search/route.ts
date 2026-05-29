import { NextRequest } from 'next/server';
import { query as dbQuery } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { publicImageFilter, ratingFilter } from '@/lib/contentFilters';

type SearchResults = {
  images?: unknown[];
  tags?: unknown[];
  users?: unknown[];
};

// GET /api/v1/search - Search across images, tags, and users
export async function GET(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all'; // all, images, tags, users
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || [];

    if (!query || query.length < 2) {
      return apiError('Query must be at least 2 characters', 400, 'INVALID_QUERY');
    }

    const results: SearchResults = {};

    // Search images
    if (type === 'all' || type === 'images') {
      // Find matching tags first
      const matchingTagsResult = await dbQuery(
        `SELECT id FROM tags WHERE name ILIKE $1 LIMIT 100`,
        [`%${query}%`]
      );
      const tagIds = matchingTagsResult.rows.map((t) => t.id);

      const whereClauses: string[] = [publicImageFilter()];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Search match either by tag, description, or username
      const orClauses: string[] = [];
      
      if (tagIds.length > 0) {
        orClauses.push(`i.id IN (SELECT image_id FROM image_tags WHERE tag_id = ANY($${paramIndex}))`);
        queryParams.push(tagIds);
        paramIndex++;
      }
      
      orClauses.push(`i.description ILIKE $${paramIndex}`);
      queryParams.push(`%${query}%`);
      paramIndex++;

      orClauses.push(`i.username ILIKE $${paramIndex}`);
      queryParams.push(`%${query}%`);
      paramIndex++;

      whereClauses.push(`(${orClauses.join(' OR ')})`);

      // Ratings filter
      const rFilter = ratingFilter(ratings, paramIndex);
      if (rFilter) {
        whereClauses.push(`i.${rFilter.clause}`);
        queryParams.push(...rFilter.params);
        paramIndex += rFilter.params.length;
      }

      const imagesResult = await dbQuery(
        `SELECT i.*
         FROM images i
         WHERE ${whereClauses.join(' AND ')}
         ORDER BY i.upvotes DESC
         LIMIT $${paramIndex}`,
        [...queryParams, limit]
      );

      const images = imagesResult.rows;

      if (images.length > 0) {
        // Batch fetch tags
        const imageIds = images.map(img => img.id);
        const tagsResult = await dbQuery(
          `SELECT it.image_id, t.name
           FROM image_tags it
           JOIN tags t ON t.id = it.tag_id
           WHERE it.image_id = ANY($1)`,
          [imageIds]
        );

        const tagsByImage = new Map<number, string[]>();
        for (const row of tagsResult.rows) {
          const list = tagsByImage.get(row.image_id) || [];
          list.push(row.name);
          tagsByImage.set(row.image_id, list);
        }

        results.images = images.map((img) => ({
          id: String(img.id),
          dbid: String(img.id),
          post_id: img.sequential_id,
          url: img.url,
          thumbnail_url: img.thumbnail_url,
          width: img.width,
          height: img.height,
          rating: img.rating,
          tags: (tagsByImage.get(img.id) || []).slice(0, 5),
          stats: {
            upvotes: img.upvotes || 0,
            views: img.views || 0,
          },
        }));
      } else {
        results.images = [];
      }
    }

    // Search tags
    if (type === 'all' || type === 'tags') {
      const tagsResult = await dbQuery(
        `SELECT id, name, type, count FROM tags WHERE name ILIKE $1 ORDER BY count DESC LIMIT $2`,
        [`%${query}%`, limit]
      );

      results.tags = tagsResult.rows.map((tag) => ({
        id: String(tag.id),
        name: tag.name,
        type: tag.type,
        count: tag.count || 0,
      }));
    }

    // Search users
    if (type === 'all' || type === 'users') {
      const usersResult = await dbQuery(
        `SELECT id, username, avatar_url, rank FROM users WHERE username ILIKE $1 LIMIT $2`,
        [`%${query}%`, limit]
      );

      results.users = usersResult.rows.map((user) => ({
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url || null,
        rank: user.rank,
      }));
    }

    return apiResponse(results, {
      query,
      type,
    });
  } catch (error) {
    console.error('API v1 search error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
