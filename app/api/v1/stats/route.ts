import { query } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/apiAuth';
import { publicImageFilter } from '@/lib/contentFilters';

// GET /api/v1/stats - Get platform statistics (public endpoint, no auth required)
export async function GET() {
  try {
    // Run stats queries in parallel
    const [
      totalImagesRes,
      totalTagsRes,
      totalUsersRes,
      ratingStatsRes,
      aiStatsRes,
      recentUploadsRes,
    ] = await Promise.all([
      query(`SELECT COUNT(*) FROM images WHERE ${publicImageFilter()}`),
      query(`SELECT COUNT(*) FROM tags`),
      query(`SELECT COUNT(*) FROM users`),
      query(`SELECT rating, COUNT(*) as count FROM images WHERE ${publicImageFilter()} GROUP BY rating`),
      query(`SELECT is_ai_generated, COUNT(*) as count FROM images WHERE ${publicImageFilter()} GROUP BY is_ai_generated`),
      query(`SELECT COUNT(*) FROM images WHERE ${publicImageFilter()} AND created_at >= NOW() - INTERVAL '24 hours'`),
    ]);

    const totalImages = parseInt(totalImagesRes.rows[0].count, 10);
    const totalTags = parseInt(totalTagsRes.rows[0].count, 10);
    const totalUsers = parseInt(totalUsersRes.rows[0].count, 10);
    const recentUploads = parseInt(recentUploadsRes.rows[0].count, 10);

    // Format rating stats
    const ratings: Record<string, number> = {
      safe: 0,
      questionable: 0,
      explicit: 0,
    };
    ratingStatsRes.rows.forEach((r) => {
      if (r.rating) ratings[r.rating] = parseInt(r.count, 10);
    });

    // Format AI stats
    let aiImages = 0;
    let nonAiImages = 0;
    aiStatsRes.rows.forEach((row) => {
      if (row.is_ai_generated === true) {
        aiImages = parseInt(row.count, 10);
      } else {
        nonAiImages = parseInt(row.count, 10);
      }
    });

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
  } catch (error) {
    console.error('API v1 stats error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
