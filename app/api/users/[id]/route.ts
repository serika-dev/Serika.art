import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL || 'https://accounts.serika.dev';
const ACCOUNTS_INTERNAL_KEY = process.env.ACCOUNTS_INTERNAL_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Try local DB first for better performance
    const { getCollection } = await import('@/lib/db');
    const { ObjectId } = await import('mongodb');
    const usersCollection = await getCollection('users');
    
    const localUser = await usersCollection.findOne({ _id: new ObjectId(id) });
    
    if (localUser) {
      return NextResponse.json({
        success: true,
        user: {
          id: localUser._id.toString(),
          username: localUser.username,
          avatarUrl: localUser.avatarUrl,
          rank: localUser.rank || 'user',
          createdAt: localUser.createdAt,
        },
      });
    }

    // Fallback: Fetch user from Serika Accounts if not in local DB
    const userRes = await axios.post(
      `${ACCOUNTS_URL}/internal/get-user`,
      {
        id,
      },
      {
        headers: {
          'X-Service-Key': ACCOUNTS_INTERNAL_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!userRes.data.success || !userRes.data.user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userRes.data.user;
    
    // Determine rank
    let rank: 'user' | 'moderator' | 'admin' | 'owner' = 'user';
    if (user.id === '692ad0df032c62f79b57a08d') {
      rank = 'owner';
    }
    
    // Store in local DB for future requests
    await usersCollection.updateOne(
      { _id: new ObjectId(user.id) },
      {
        $set: {
          username: user.username,
          avatarUrl: user.avatar || '',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          rank,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar,
        rank,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
