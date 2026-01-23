import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL || 'https://accounts.serika.dev';
const ACCOUNTS_INTERNAL_KEY = process.env.ACCOUNTS_INTERNAL_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { email, password, rememberMe = true } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Step 1: Login to Serika Accounts
    let accountsResponse;
    try {
      accountsResponse = await axios.post(
        `${ACCOUNTS_URL}/api/auth/login`,
        {
          email,
          password,
          rememberMe,
          productId: 'serika-art',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.error || error.response?.data?.message || 'Login failed';
      return NextResponse.json(
        { success: false, error: message },
        { status }
      );
    }

    if (!accountsResponse.data.success || !accountsResponse.data.token) {
      return NextResponse.json(
        { success: false, error: accountsResponse.data.error || accountsResponse.data.message || 'Login failed' },
        { status: 401 }
      );
    }

    const token = accountsResponse.data.token;

    // Step 2: Verify the token with Serika Accounts using internal endpoint
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

    // Step 3: Fetch full user details using the internal get-user endpoint
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

    // Step 4: Store/update user in local database
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
          rank: existingUser?.rank || rank,
        },
      },
      { upsert: true }
    );

    // Step 5: Store the session token in an HTTP-only cookie (for web)
    const cookieStore = await cookies();
    cookieStore.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    cookieStore.set(
      'user_info',
      JSON.stringify({
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar,
      }),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      }
    );

    // Return token for mobile apps that need to store it themselves
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar,
        rank: existingUser?.rank || rank,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}
