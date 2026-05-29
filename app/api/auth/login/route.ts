import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

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
        { email, password, rememberMe, productId: 'serika-art' },
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.error || error.response?.data?.message || 'Login failed';
      return NextResponse.json({ success: false, error: message }, { status });
    }

    if (!accountsResponse.data.success || !accountsResponse.data.token) {
      return NextResponse.json(
        { success: false, error: accountsResponse.data.error || 'Login failed' },
        { status: 401 }
      );
    }

    const token = accountsResponse.data.token;

    // Step 2: Verify token
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

    // Step 3: Fetch full user details
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

    // Step 4: Upsert user in PostgreSQL
    let rank: 'user' | 'moderator' | 'admin' | 'owner' = 'user';
    if (user.id === '692ad0df032c62f79b57a08d') {
      rank = 'owner';
    }

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

    // Step 5: Set cookies
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
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar,
        rank: finalRank,
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
