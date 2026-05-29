import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';

// GET /api/v1/users/[id] - Get user public profile (by ID or username)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const validation = await validateApiKey(request, ['users:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const { id } = await params;

    // Find in local Postgres users table
    let userResult = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (userResult.rows.length === 0) {
      userResult = await query(
        `SELECT * FROM users WHERE LOWER(username) = LOWER($1)`,
        [id]
      );
    }

    if (userResult.rows.length === 0) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    const user = userResult.rows[0];

    // Get user stats in a single SQL query
    const statsResult = await query(
      `SELECT COUNT(*) as image_count,
              COALESCE(SUM(upvotes), 0) as total_upvotes,
              COALESCE(SUM(views), 0) as total_views
       FROM images
       WHERE user_id = $1`,
      [user.id]
    );

    const stats = statsResult.rows[0];

    const formattedUser = {
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url || null,
      rank: user.rank,
      stats: {
        images: parseInt(stats.image_count, 10),
        total_upvotes: parseInt(stats.total_upvotes, 10),
        total_views: parseInt(stats.total_views, 10),
      },
      created_at: user.created_at,
    };

    return apiResponse(formattedUser);
  } catch (error: any) {
    console.error('API v1 user error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
