import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { publicImageFilter, ratingFilter } from '@/lib/contentFilters';

// GET /api/v1/trending - Get trending images and tags
export async function GET(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'day'; // day, week, month
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const ratingsParam = searchParams.get('ratings') || 'safe';
    const ratings = ratingsParam.split(',').filter((r) => ['safe', 'questionable', 'explicit'].includes(r));

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // day
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const whereClauses = [publicImageFilter(), `i.created_at >= $1`];
    const queryParams: any[] = [startDate];
    let paramIndex = 2;

    const rFilter = ratingFilter(ratings, paramIndex);
    if (rFilter) {
      whereClauses.push(`i.${rFilter.clause}`);
      queryParams.push(...rFilter.params);
      paramIndex += rFilter.params.length;
    }

    // Get trending images (high engagement in the period)
    const trendingResult = await query(
      `SELECT i.*,
              ((i.upvotes * 3) + (i.favorites * 5) + (i.views * 0.1)) as trend_score
       FROM images i
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY trend_score DESC
       LIMIT $${paramIndex}`,
      [...queryParams, limit]
    );

    const trendingImages = trendingResult.rows;

    if (trendingImages.length === 0) {
      return apiResponse({
        period,
        images: [],
        tags: [],
      });
    }

    // Get all tag IDs from trending images
    const imageIds = trendingImages.map(img => img.id);
    const tagsResult = await query(
      `SELECT it.image_id, t.id, t.name, t.type, t.count
       FROM image_tags it
       JOIN tags t ON t.id = it.tag_id
       WHERE it.image_id = ANY($1)`,
      [imageIds]
    );

    const tagCounts: Record<number, number> = {};
    const tagMap = new Map<number, any>();
    const tagsByImage = new Map<number, string[]>();

    for (const row of tagsResult.rows) {
      tagCounts[row.id] = (tagCounts[row.id] || 0) + 1;
      tagMap.set(row.id, row);

      const list = tagsByImage.get(row.image_id) || [];
      list.push(row.name);
      tagsByImage.set(row.image_id, list);
    }

    // Get trending tags (most used in trending images)
    const trendingTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tagIdStr, count]) => {
        const tagId = parseInt(tagIdStr, 10);
        const tag = tagMap.get(tagId);
        return tag ? {
          id: String(tag.id),
          name: tag.name,
          type: tag.type,
          trending_count: count,
          total_count: tag.count || 0,
        } : null;
      })
      .filter(Boolean);

    // Format images
    const formattedImages = trendingImages.map((img) => ({
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
      trend_score: Math.round(img.trend_score),
      tags: (tagsByImage.get(img.id) || []).slice(0, 5),
      stats: {
        upvotes: img.upvotes || 0,
        favorites: img.favorites || 0,
        views: img.views || 0,
      },
      uploaded_at: img.created_at,
    }));

    return apiResponse({
      period,
      images: formattedImages,
      tags: trendingTags,
    });
  } catch (error) {
    console.error('API Error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
