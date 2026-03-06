import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL || 'https://accounts.serika.dev';
const ACCOUNTS_INTERNAL_KEY = process.env.ACCOUNTS_INTERNAL_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token required' },
        { status: 400 }
      );
    }

    // Verify the token with Serika Accounts using internal endpoint
    const verifyRes = await axios.post(
      `${ACCOUNTS_URL}/internal/verify`,
      {
        token,
        checkBan: true,
      },
      {
        headers: {
          'X-Service-Key': ACCOUNTS_INTERNAL_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!verifyRes.data.valid || !verifyRes.data.user) {
      console.error('Token verification failed:', verifyRes.data);
      return NextResponse.json(
        { success: false, error: verifyRes.data.error || 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = verifyRes.data.user.id;

    // Fetch full user details using the internal get-user endpoint
    const userRes = await axios.post(
      `${ACCOUNTS_URL}/internal/get-user`,
      {
        id: userId,
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
        { success: false, error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    const user = userRes.data.user;

    // Store/update user in local database
    const { getCollection } = await import('@/lib/db');
    const { ObjectId } = await import('mongodb');
    const usersCollection = await getCollection('users');
    
    // Determine rank - owner is hardcoded, others default to user
    let rank: 'user' | 'moderator' | 'admin' | 'owner' = 'user';
    if (user.id === '692ad0df032c62f79b57a08d') {
      rank = 'owner';
    }
    
    const existingUser = await usersCollection.findOne({ _id: new ObjectId(user.id) });
    
    await usersCollection.updateOne(
      { _id: new ObjectId(user.id) },
      {
        $set: {
          username: user.username,
          email: user.email,
          avatarUrl: user.avatar || '',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          rank: existingUser?.rank || rank, // Keep existing rank or set new one
        },
      },
      { upsert: true }
    );

    // Store the session token in an HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Store user info for the client in a separate cookie (non-sensitive)
    cookieStore.set(
      'user_info',
      JSON.stringify({
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar,
      }),
      {
        httpOnly: false, // Accessible by client JS
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      }
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar,
      },
    });
  } catch (error: any) {
    console.error('Session exchange error:', error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: 'Session exchange failed' },
      { status: 500 }
    );
  }
}
