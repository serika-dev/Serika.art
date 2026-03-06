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
    let useAggregation = false;
    
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
      case 'uploads':
      case 'uploads-asc':
        // Use aggregation for upload count sorting
        useAggregation = true;
        break;
      case 'newest':
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    let users: any[];
    let total: number;

    if (useAggregation) {
      // Use aggregation pipeline for upload count sorting
      const pipeline: any[] = [
        ...(search ? [{ $match: { username: { $regex: search, $options: 'i' } } }] : []),
        {
          $lookup: {
            from: 'images',
            localField: '_id',
            foreignField: 'userId',
            as: 'uploads',
          },
        },
        {
          $addFields: {
            uploadCount: { $size: '$uploads' },
          },
        },
        {
          $project: {
            username: 1,
            avatarUrl: 1,
            rank: 1,
            createdAt: 1,
            uploadCount: 1,
          },
        },
        {
          $sort: { uploadCount: sort === 'uploads' ? -1 : 1 },
        },
      ];

      [users, total] = await Promise.all([
        usersCollection.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]).toArray(),
        usersCollection.aggregate([
          ...(search ? [{ $match: { username: { $regex: search, $options: 'i' } } }] : []),
          { $count: 'total' }
        ]).toArray().then(result => result[0]?.total || 0),
      ]);
    } else {
      // Execute query and count in parallel
      [users, total] = await Promise.all([
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
      users = users.map((user: any) => ({
        ...user,
        uploadCount: uploadCountMap.get(user._id.toString()) || 0,
      }));
    }

    return NextResponse.json({
      success: true,
      users: users,
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
