import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import axios from 'axios';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL || 'https://accounts.serika.dev';
const ACCOUNTS_INTERNAL_KEY = process.env.ACCOUNTS_INTERNAL_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try local DB first
    const localResult = await query(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );

    if (localResult.rows.length > 0) {
      const localUser = localResult.rows[0];
      return NextResponse.json({
        success: true,
        user: {
          id: localUser.id,
          username: localUser.username,
          avatarUrl: localUser.avatar_url,
          rank: localUser.rank || 'user',
          createdAt: localUser.created_at,
        },
      });
    }

    // Fallback: Fetch from Serika Accounts
    const userRes = await axios.post(
      `${ACCOUNTS_URL}/internal/get-user`,
      { id },
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

    let rank: 'user' | 'moderator' | 'admin' | 'owner' = 'user';
    if (user.id === '692ad0df032c62f79b57a08d') {
      rank = 'owner';
    }

    // Store in local DB for future requests
    await query(
      `INSERT INTO users (id, username, email, avatar_url, rank, created_at, updated_at)
       VALUES ($1, $2, '', $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
         username = $2, avatar_url = $3, updated_at = NOW()`,
      [user.id, user.username, user.avatar || '', rank,
       user.createdAt ? new Date(user.createdAt) : new Date()]
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
