import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { imageId, type } = await request.json();

    const sequentialId = parseInt(imageId, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    if (!['upvote', 'downvote', ''].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid vote type' },
        { status: 400 }
      );
    }

    // Get image
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

    // Check existing vote
    const existingVote = await query(
      `SELECT id, type FROM votes WHERE user_id = $1 AND image_id = $2`,
      [user.id, imageDbId]
    );

    let userVote: string | null = null;

    if (type === '' || (existingVote.rows.length > 0 && existingVote.rows[0].type === type)) {
      // Remove vote
      if (existingVote.rows.length > 0) {
        const oldType = existingVote.rows[0].type;
        await query(`DELETE FROM votes WHERE id = $1`, [existingVote.rows[0].id]);
        const col = oldType === 'upvote' ? 'upvotes' : 'downvotes';
        await query(
          `UPDATE images SET ${col} = GREATEST(${col} - 1, 0) WHERE id = $1`,
          [imageDbId]
        );
      }
      userVote = null;
    } else if (existingVote.rows.length > 0) {
      // Change vote
      const oldType = existingVote.rows[0].type;
      await query(
        `UPDATE votes SET type = $1, created_at = NOW() WHERE id = $2`,
        [type, existingVote.rows[0].id]
      );
      const decCol = oldType === 'upvote' ? 'upvotes' : 'downvotes';
      const incCol = type === 'upvote' ? 'upvotes' : 'downvotes';
      await query(
        `UPDATE images SET ${decCol} = GREATEST(${decCol} - 1, 0), ${incCol} = ${incCol} + 1 WHERE id = $1`,
        [imageDbId]
      );
      userVote = type;
    } else {
      // New vote
      await query(
        `INSERT INTO votes (user_id, image_id, type, created_at) VALUES ($1, $2, $3, NOW())`,
        [user.id, imageDbId, type]
      );
      const col = type === 'upvote' ? 'upvotes' : 'downvotes';
      await query(
        `UPDATE images SET ${col} = ${col} + 1 WHERE id = $1`,
        [imageDbId]
      );
      userVote = type;
    }

    // Get updated counts
    const updated = await query(
      `SELECT upvotes, downvotes FROM images WHERE id = $1`,
      [imageDbId]
    );

    return NextResponse.json({
      success: true,
      upvotes: updated.rows[0]?.upvotes || 0,
      downvotes: updated.rows[0]?.downvotes || 0,
      userVote,
    });
  } catch (error: any) {
    console.error('Error voting:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to vote' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to process vote' },
      { status: 500 }
    );
  }
}
