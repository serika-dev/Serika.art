import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { castVote } from '@/lib/votes';

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

    const { previous, current } = await castVote(user.id, imageDbId, type);

    // Keep the denormalized counters on images in step with the change.
    if (previous !== current) {
      if (previous && current) {
        const decCol = previous === 'upvote' ? 'upvotes' : 'downvotes';
        const incCol = current === 'upvote' ? 'upvotes' : 'downvotes';
        await query(
          `UPDATE images SET ${decCol} = GREATEST(${decCol} - 1, 0), ${incCol} = ${incCol} + 1 WHERE id = $1`,
          [imageDbId]
        );
      } else if (previous) {
        const col = previous === 'upvote' ? 'upvotes' : 'downvotes';
        await query(
          `UPDATE images SET ${col} = GREATEST(${col} - 1, 0) WHERE id = $1`,
          [imageDbId]
        );
      } else if (current) {
        const col = current === 'upvote' ? 'upvotes' : 'downvotes';
        await query(
          `UPDATE images SET ${col} = ${col} + 1 WHERE id = $1`,
          [imageDbId]
        );
      }
    }
    const userVote = current;

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
