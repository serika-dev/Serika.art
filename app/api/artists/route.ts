import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    const [artistsResult, countResult] = await Promise.all([
      query(
        `SELECT a.*, t.count as post_count
         FROM artists a
         JOIN tags t ON t.id = a.tag_id
         ORDER BY t.count DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query(`SELECT COUNT(*) as count FROM artists`),
    ]);

    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      success: true,
      artists: artistsResult.rows.map(a => ({
        _id: String(a.id),
        tagId: String(a.tag_id),
        tagName: a.tag_name,
        claimedByUserId: a.claimed_by_user_id,
        claimedByUsername: a.claimed_by_username,
        verified: a.verified,
        avatarUrl: a.avatar_url,
        bannerUrl: a.banner_url,
        bio: a.bio,
        socials: a.socials || {},
        postCount: a.post_count,
        createdAt: a.created_at,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching artists:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artists' },
      { status: 500 }
    );
  }
}
