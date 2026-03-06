import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin or owner
    const { ObjectId } = await import('mongodb');
    const usersCollection = await getCollection('users');
    const userDoc = await usersCollection.findOne({ _id: new ObjectId(user.id) });
    
    const rank = userDoc?.rank || 'user';
    
    if (rank !== 'admin' && rank !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get search query
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    // Build search filter
    const filter: any = {};
    if (query) {
      filter.$or = [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ];
    }

    // Fetch users
    const users = await usersCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      success: true,
      users: users.map(u => ({
        _id: u._id.toString(),
        username: u.username,
        email: u.email,
        avatarUrl: u.avatarUrl,
        rank: u.rank || 'user',
        createdAt: u.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
