import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { UserRank } from '@/lib/models';

const OWNER_ID = '692ad0df032c62f79b57a08d';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user's rank
    const { ObjectId } = await import('mongodb');
    const usersCollection = await getCollection('users');
    const currentUserDoc = await usersCollection.findOne({ _id: new ObjectId(user.id) });
    
    const currentUserRank = currentUserDoc?.rank || 'user';
    
    if (currentUserRank !== 'admin' && currentUserRank !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { rank } = body;

    // Validate rank
    const validRanks: UserRank[] = ['user', 'moderator', 'admin', 'owner'];
    if (!validRanks.includes(rank)) {
      return NextResponse.json(
        { success: false, error: 'Invalid rank' },
        { status: 400 }
      );
    }

    // Prevent editing owner
    if (id === OWNER_ID) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify owner rank' },
        { status: 403 }
      );
    }

    // Only owner can promote to admin
    if (rank === 'admin' && currentUserRank !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Only owner can promote to admin' },
        { status: 403 }
      );
    }

    // Prevent promoting to owner
    if (rank === 'owner') {
      return NextResponse.json(
        { success: false, error: 'Cannot promote to owner' },
        { status: 403 }
      );
    }

    // Update user rank
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          rank,
          updatedAt: new Date(),
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch updated user
    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      success: true,
      user: {
        _id: updatedUser!._id.toString(),
        username: updatedUser!.username,
        email: updatedUser!.email,
        avatarUrl: updatedUser!.avatarUrl,
        rank: updatedUser!.rank || 'user',
        createdAt: updatedUser!.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
