import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { ObjectId } from 'mongodb';

// GET /api/v1/users/[id] - Get user public profile
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

    if (!ObjectId.isValid(id)) {
      return apiError('Invalid user ID', 400, 'INVALID_ID');
    }

    const usersCollection = await getCollection('users');
    const imagesCollection = await getCollection('images');

    const user = await usersCollection.findOne({ _id: new ObjectId(id) });

    if (!user) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    // Get user stats
    const [imageCount, totalUpvotes, totalViews] = await Promise.all([
      imagesCollection.countDocuments({ userId: new ObjectId(id) }),
      imagesCollection.aggregate([
        { $match: { userId: new ObjectId(id) } },
        { $group: { _id: null, total: { $sum: '$upvotes' } } },
      ]).toArray(),
      imagesCollection.aggregate([
        { $match: { userId: new ObjectId(id) } },
        { $group: { _id: null, total: { $sum: '$views' } } },
      ]).toArray(),
    ]);

    const formattedUser = {
      id: user._id.toString(),
      username: user.username,
      avatar_url: user.avatarUrl || null,
      rank: user.rank,
      stats: {
        images: imageCount,
        total_upvotes: totalUpvotes[0]?.total || 0,
        total_views: totalViews[0]?.total || 0,
      },
      created_at: user.createdAt,
    };

    return apiResponse(formattedUser);
  } catch (error: any) {
    console.error('API v1 user error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
