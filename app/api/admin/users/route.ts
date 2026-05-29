import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

async function checkAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  const result = await query(`SELECT rank FROM users WHERE id = $1`, [user.id]);
  const rank = result.rows[0]?.rank;
  if (rank === 'admin' || rank === 'owner') return { ...user, rank };
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await checkAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('q') || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause = `WHERE LOWER(username) LIKE LOWER($${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const [usersResult, countResult] = await Promise.all([
      query(
        `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) as count FROM users ${whereClause}`, params),
    ]);

    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      success: true,
      users: usersResult.rows.map(u => ({
        _id: u.id,
        id: u.id,
        username: u.username,
        email: u.email,
        avatarUrl: u.avatar_url,
        rank: u.rank,
        createdAt: u.created_at,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
