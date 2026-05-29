import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all';

    // Find user by ID or username
    let userResult = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (userResult.rows.length === 0) {
      userResult = await query(
        `SELECT * FROM users WHERE LOWER(username) = LOWER($1)`,
        [id]
      );
    }

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = userResult.rows[0].id;
    const result: any = { success: true };

    // Get liked posts
    if (type === 'likes' || type === 'all') {
      const likesResult = await query(
        `SELECT i.*
         FROM votes v
         JOIN images i ON i.id = v.image_id
         WHERE v.user_id = $1 AND v.type = 'upvote'
         ORDER BY v.created_at DESC
         LIMIT 50`,
        [userId]
      );

      const likedImages = likesResult.rows;

      // Populate tags
      if (likedImages.length > 0) {
        const imageIds = likedImages.map(img => img.id);
        const tagsResult = await query(
          `SELECT it.image_id, t.id as tag_id, t.name, t.type, t.count
           FROM image_tags it JOIN tags t ON t.id = it.tag_id
           WHERE it.image_id = ANY($1::int[])`,
          [imageIds]
        );

        const tagsByImage = new Map<number, any[]>();
        for (const row of tagsResult.rows) {
          const list = tagsByImage.get(row.image_id) || [];
          list.push({ _id: row.tag_id, name: row.name, type: row.type, count: row.count });
          tagsByImage.set(row.image_id, list);
        }

        for (const img of likedImages) {
          (img as any).tags = tagsByImage.get(img.id) || [];
          (img as any).dbid = String(img.id);
          (img as any)._id = String(img.id);
          (img as any).sequentialId = img.sequential_id;
          (img as any).thumbnailUrl = img.thumbnail_url;
        }
      }

      result.likes = likedImages;
    }

    // Get comments
    if (type === 'comments' || type === 'all') {
      const commentsResult = await query(
        `SELECT c.id, c.content, c.created_at, c.image_id,
                i.sequential_id, i.thumbnail_url, i.url
         FROM comments c
         LEFT JOIN images i ON i.id = c.image_id
         WHERE c.user_id = $1
         ORDER BY c.created_at DESC
         LIMIT 50`,
        [userId]
      );

      result.comments = commentsResult.rows.map(c => ({
        _id: String(c.id),
        content: c.content,
        createdAt: c.created_at,
        image: c.sequential_id ? {
          sequentialId: c.sequential_id,
          thumbnailUrl: c.thumbnail_url || c.url,
        } : null,
      }));
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching user activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user activity' },
      { status: 500 }
    );
  }
}
