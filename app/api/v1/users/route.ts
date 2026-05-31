import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 100);
    const sort = searchParams.get('sort') || 'newest';
    const search = searchParams.get('q') || '';

    const skip = (page - 1) * limit;

    const whereClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIdx = 1;

    // Exclude auto-generated dummy placeholder accounts from the user directory
    whereClauses.push(`u.username !~ '^user_[a-zA-Z0-9]{6}$'`);

    if (search) {
      whereClauses.push(`u.username ILIKE $${paramIdx}`);
      queryParams.push(`%${search}%`);
      paramIdx++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Determine sort
    let sortClause = 'u.created_at DESC, u.id DESC';
    switch (sort) {
      case 'oldest':
        sortClause = 'u.created_at ASC, u.id ASC';
        break;
      case 'alphabetical':
        sortClause = 'u.username ASC, u.id ASC';
        break;
      case 'alphabetical-reverse':
        sortClause = 'u.username DESC, u.id DESC';
        break;
      case 'uploads':
        sortClause = 'upload_count DESC, u.id DESC';
        break;
      case 'uploads-asc':
        sortClause = 'upload_count ASC, u.id ASC';
        break;
    }

    // Get count and data in parallel
    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereString}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const usersResult = await query(
      `SELECT u.id, u.username, u.avatar_url, u.rank, u.created_at,
              COUNT(i.id) as upload_count
       FROM users u
       LEFT JOIN images i ON i.user_id = u.id AND i.deleted = FALSE AND i.unlisted = FALSE
       ${whereString}
       GROUP BY u.id, u.username, u.avatar_url, u.rank, u.created_at
       ORDER BY ${sortClause}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...queryParams, limit, skip]
    );

    const formattedUsers = usersResult.rows.map(user => ({
      _id: user.id,
      id: user.id,
      username: user.username,
      avatarUrl: user.avatar_url,
      rank: user.rank,
      createdAt: user.created_at,
      uploadCount: parseInt(user.upload_count, 10),
    }));

    return NextResponse.json({
      success: true,
      users: formattedUsers,
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
