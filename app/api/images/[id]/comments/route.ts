import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const imgResult = await query(
      `SELECT id FROM images WHERE sequential_id = $1`,
      [sequentialId]
    );
    if (imgResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    const imageDbId = imgResult.rows[0].id;

    const commentsResult = await query(
      `SELECT * FROM comments WHERE image_id = $1 ORDER BY created_at ASC`,
      [imageDbId]
    );

    // Get artist tag names for artist comments
    const artistTagIds = commentsResult.rows
      .filter(c => c.artist_tag_id)
      .map(c => c.artist_tag_id);

    let artistTagNames: Record<number, string> = {};
    if (artistTagIds.length > 0) {
      const tagResult = await query(
        `SELECT id, name FROM tags WHERE id = ANY($1::int[])`,
        [artistTagIds]
      );
      artistTagNames = tagResult.rows.reduce((acc, t) => {
        acc[t.id] = t.name;
        return acc;
      }, {} as Record<number, string>);
    }

    return NextResponse.json({
      success: true,
      comments: commentsResult.rows.map(c => ({
        _id: String(c.id),
        imageId: String(c.image_id),
        userId: c.user_id,
        username: c.username,
        avatarUrl: c.avatar_url,
        rank: c.rank || 'user',
        content: c.content,
        parentId: c.parent_id ? String(c.parent_id) : undefined,
        asArtist: c.as_artist || false,
        artistTagName: c.artist_tag_id ? artistTagNames[c.artist_tag_id] : undefined,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to comment' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { content, parentId, asArtist, artistTagId } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment cannot be empty' },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Comment is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const imgResult = await query(
      `SELECT id FROM images WHERE sequential_id = $1`,
      [sequentialId]
    );
    if (imgResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }
    const imageDbId = imgResult.rows[0].id;

    // Get user details
    const userResult = await query(
      `SELECT username, avatar_url, rank FROM users WHERE id = $1`,
      [user.id]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    const userDoc = userResult.rows[0];

    // Validate artist claim
    let validatedArtistTagId: number | undefined;
    if (asArtist && artistTagId) {
      const artistResult = await query(
        `SELECT id FROM artists WHERE tag_id = $1 AND claimed_by_user_id = $2 AND verified = TRUE`,
        [parseInt(artistTagId), user.id]
      );
      if (artistResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'You are not verified as this artist' },
          { status: 403 }
        );
      }

      // Check if image has this tag
      const hasTag = await query(
        `SELECT 1 FROM image_tags WHERE image_id = $1 AND tag_id = $2`,
        [imageDbId, parseInt(artistTagId)]
      );
      if (hasTag.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'This image is not tagged with your artist tag' },
          { status: 400 }
        );
      }
      validatedArtistTagId = parseInt(artistTagId);
    }

    const commentResult = await query(
      `INSERT INTO comments (image_id, user_id, username, avatar_url, rank, content, parent_id, as_artist, artist_tag_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        imageDbId, user.id, userDoc.username, userDoc.avatar_url,
        userDoc.rank || 'user', content.trim(),
        parentId ? parseInt(parentId) : null,
        asArtist && validatedArtistTagId ? true : false,
        validatedArtistTagId || null,
      ]
    );

    const comment = commentResult.rows[0];

    // Get artist tag name if applicable
    let artistTagName: string | undefined;
    if (validatedArtistTagId) {
      const tagResult = await query(`SELECT name FROM tags WHERE id = $1`, [validatedArtistTagId]);
      artistTagName = tagResult.rows[0]?.name;
    }

    return NextResponse.json({
      success: true,
      comment: {
        _id: String(comment.id),
        imageId: String(comment.image_id),
        userId: comment.user_id,
        username: comment.username,
        avatarUrl: comment.avatar_url,
        rank: comment.rank,
        content: comment.content,
        parentId: comment.parent_id ? String(comment.parent_id) : undefined,
        asArtist: comment.as_artist,
        artistTagName,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
