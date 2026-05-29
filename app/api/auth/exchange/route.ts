import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL || 'https://accounts.serika.dev';
const ACCOUNTS_INTERNAL_KEY = process.env.ACCOUNTS_INTERNAL_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Verify token with Serika Accounts
    const verifyRes = await axios.post(
      `${ACCOUNTS_URL}/internal/verify`,
      { token, checkBan: true },
      {
        headers: {
          'X-Service-Key': ACCOUNTS_INTERNAL_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!verifyRes.data.valid || !verifyRes.data.user) {
      return NextResponse.json(
        { success: false, error: verifyRes.data.error || 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = verifyRes.data.user.id;

    // Fetch full user details
    const userRes = await axios.post(
      `${ACCOUNTS_URL}/internal/get-user`,
      { id: userId },
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

    // Determine rank
    let rank: 'user' | 'moderator' | 'admin' | 'owner' = 'user';
    if (user.id === '692ad0df032c62f79b57a08d') {
      rank = 'owner';
    }

    // Check if user exists to preserve rank
    const existingUser = await query(
      `SELECT rank FROM users WHERE id = $1`,
      [user.id]
    );

    const finalRank = existingUser.rows[0]?.rank || rank;

    await query(
      `INSERT INTO users (id, username, email, avatar_url, rank, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET
         username = $2, email = $3, avatar_url = $4, updated_at = NOW()`,
      [user.id, user.username, user.email, user.avatar || '', finalRank,
       user.createdAt ? new Date(user.createdAt) : new Date()]
    );

    // Store the session token
    const cookieStore = await cookies();
    cookieStore.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
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
