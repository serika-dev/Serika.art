import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/apiAuth';

// GET /api/v1/stats - Get platform statistics (public endpoint, no auth required)
export async function GET(request: NextRequest) {
  try {
    const imagesCollection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    const usersCollection = await getCollection('users');

    // Get statistics
    const [
      totalImages,
      totalTags,
      totalUsers,
      ratingStats,
      aiStats,
      recentUploads,
    ] = await Promise.all([
      imagesCollection.countDocuments(),
      tagsCollection.countDocuments(),
      usersCollection.countDocuments(),
      imagesCollection.aggregate([
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
      ]).toArray(),
      imagesCollection.aggregate([
        {
          $group: {
            _id: '$isAIGenerated',
            count: { $sum: 1 },
          },
        },
      ]).toArray(),
      imagesCollection.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);

    // Format rating stats
    const ratings: Record<string, number> = {
      safe: 0,
      questionable: 0,
      explicit: 0,
    };
    ratingStats.forEach((r) => {
      if (r._id) ratings[r._id] = r.count;
    });

    // Format AI stats
    const aiImages = aiStats.find((a) => a._id === true)?.count || 0;
    const nonAiImages = aiStats.find((a) => a._id !== true)?.count || 0;

    return apiResponse({
      totals: {
        images: totalImages,
        tags: totalTags,
        users: totalUsers,
      },
      images_by_rating: ratings,
      images_by_type: {
        ai_generated: aiImages,
        non_ai: nonAiImages,
      },
      activity: {
        uploads_last_24h: recentUploads,
      },
    });
  } catch (error: any) {
    console.error('API v1 stats error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
