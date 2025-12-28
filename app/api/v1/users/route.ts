import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const sort = searchParams.get('sort') || 'newest';
    const search = searchParams.get('q') || '';

    const skip = (page - 1) * limit;

    const usersCollection = await getCollection('users');
    const imagesCollection = await getCollection('images');

    // Build query
    const query: any = {};
    
    if (search) {
      query.username = { $regex: search, $options: 'i' };
    }

    // Determine sort
    let sortOption: any = { createdAt: -1 };
    switch (sort) {
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'alphabetical':
        sortOption = { username: 1 };
        break;
      case 'alphabetical-reverse':
        sortOption = { username: -1 };
        break;
      case 'newest':
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    // Execute query and count in parallel
    const [users, total] = await Promise.all([
      usersCollection
        .find(query, {
          projection: {
            username: 1,
            avatarUrl: 1,
            rank: 1,
            createdAt: 1,
          },
        })
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .toArray(),
      usersCollection.countDocuments(query),
    ]);

    // Get upload counts for each user
    const userIds = users.map(u => u._id);
    const uploadCounts = await imagesCollection
      .aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ])
      .toArray();

    const uploadCountMap = new Map(uploadCounts.map(uc => [uc._id.toString(), uc.count]));

    // Enrich users with upload counts
    const enrichedUsers = users.map((user: any) => ({
      ...user,
      uploadCount: uploadCountMap.get(user._id.toString()) || 0,
    }));

    // For upload count sorting, sort after enrichment
    if (sort === 'uploads') {
      enrichedUsers.sort((a, b) => b.uploadCount - a.uploadCount);
    } else if (sort === 'uploads-asc') {
      enrichedUsers.sort((a, b) => a.uploadCount - b.uploadCount);
    }

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
