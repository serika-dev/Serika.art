import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PATCH - Edit a comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const commentId = parseInt(id, 10);
    if (isNaN(commentId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid comment ID' },
        { status: 400 }
      );
    }

    const { content } = await request.json();
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment content cannot be empty' },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Comment is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Fetch comment to check ownership
    const commentRes = await query(
      `SELECT * FROM comments WHERE id = $1`,
      [commentId]
    );

    if (commentRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    const comment = commentRes.rows[0];

    // Only comment creator or a moderator/admin can edit
    const isCreator = comment.user_id === user.id;
    const isModerator = ['moderator', 'admin', 'owner'].includes(user.rank || '');

    if (!isCreator && !isModerator) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Update comment
    await query(
      `UPDATE comments SET content = $1, updated_at = NOW() WHERE id = $2`,
      [content.trim(), commentId]
    );

    return NextResponse.json({
      success: true,
      message: 'Comment updated successfully',
    });
  } catch (error: any) {
    console.error('Error editing comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to edit comment' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const commentId = parseInt(id, 10);
    if (isNaN(commentId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid comment ID' },
        { status: 400 }
      );
    }

    // Fetch comment to check ownership
    const commentRes = await query(
      `SELECT * FROM comments WHERE id = $1`,
      [commentId]
    );

    if (commentRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    const comment = commentRes.rows[0];

    // Only comment creator or a moderator/admin can delete
    const isCreator = comment.user_id === user.id;
    const isModerator = ['moderator', 'admin', 'owner'].includes(user.rank || '');

    if (!isCreator && !isModerator) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Delete comment (parent_id references CASCADE automatically deletes child replies)
    await query(
      `DELETE FROM comments WHERE id = $1`,
      [commentId]
    );

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
