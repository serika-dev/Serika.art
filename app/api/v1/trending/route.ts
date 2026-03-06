import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';

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

    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');

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

    // Get trending images (high engagement in the period)
    const trendingImages = await collection
      .aggregate([
        {
          $match: {
            rating: { $in: ratings },
            uploadedAt: { $gte: startDate },
          },
        },
        {
          $addFields: {
            trendScore: {
              $add: [
                { $multiply: ['$upvotes', 3] },
                { $multiply: ['$favorites', 5] },
                { $multiply: ['$views', 0.1] },
              ],
            },
          },
        },
        { $sort: { trendScore: -1 } },
        { $limit: limit },
      ])
      .toArray();

    // Get all tag IDs from trending images
    const allTagIds = new Set<string>();
    const tagCounts: Record<string, number> = {};
    
    trendingImages.forEach((img) => {
      (img.tags || []).forEach((tagId: any) => {
        const idStr = tagId.toString();
        allTagIds.add(idStr);
        tagCounts[idStr] = (tagCounts[idStr] || 0) + 1;
      });
    });

    const tagDocs = await tagsCollection
      .find({ _id: { $in: Array.from(allTagIds).map((id) => new (require('mongodb').ObjectId)(id)) } })
      .toArray();
    const tagMap = new Map(tagDocs.map((t) => [t._id.toString(), t]));

    // Get trending tags (most used in trending images)
    const trendingTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tagId, count]) => {
        const tag = tagMap.get(tagId);
        return tag ? {
          id: tag._id.toString(),
          name: tag.name,
          type: tag.type,
          trending_count: count,
          total_count: tag.count || 0,
        } : null;
      })
      .filter(Boolean);

    // Format images
    const formattedImages = trendingImages.map((img) => ({
      id: img._id.toString(),
      dbid: img._id.toString(),
      post_id: img.sequentialId,
      sequential_id: img.sequentialId,
      url: img.url,
      thumbnail_url: img.thumbnailUrl,
      width: img.width,
      height: img.height,
      rating: img.rating,
      is_ai_generated: img.isAIGenerated || false,
      trend_score: Math.round(img.trendScore),
      tags: (img.tags || []).slice(0, 5).map((tagId: any) => {
        const tag = tagMap.get(tagId.toString());
        return tag?.name || 'unknown';
      }),
      stats: {
        upvotes: img.upvotes || 0,
        favorites: img.favorites || 0,
        views: img.views || 0,
      },
      uploaded_at: img.uploadedAt,
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
