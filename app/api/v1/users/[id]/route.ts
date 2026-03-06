import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { ObjectId } from 'mongodb';

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

    const usersCollection = await getCollection('users');
    const imagesCollection = await getCollection('images');

    // Try to find by ObjectId first, then by username
    let user;
    let userId: ObjectId | undefined;
    
    // Check if it's a valid 24-character hex string (MongoDB ObjectId format)
    const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(id);
    
    if (isValidObjectId) {
      try {
        user = await usersCollection.findOne({ _id: new ObjectId(id) });
        if (user) {
          userId = new ObjectId(id);
        }
      } catch {
        // Not a valid ObjectId, will try username
      }
    }
    
    // If not found by ID, try username (case-insensitive)
    if (!user) {
      // Escape special regex characters in username
      const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      user = await usersCollection.findOne({ 
        username: { $regex: new RegExp(`^${escapedId}$`, 'i') }
      });
      if (user) {
        userId = user._id;
      }
    }

    if (!user || !userId) {
      return apiError('User not found', 404, 'NOT_FOUND');
    }

    // Get user stats
    const [imageCount, totalUpvotes, totalViews] = await Promise.all([
      imagesCollection.countDocuments({ userId: userId! }),
      imagesCollection.aggregate([
        { $match: { userId: userId! } },
        { $group: { _id: null, total: { $sum: '$upvotes' } } },
      ]).toArray(),
      imagesCollection.aggregate([
        { $match: { userId: userId! } },
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
