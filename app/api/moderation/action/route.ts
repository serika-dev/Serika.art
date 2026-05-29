import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userResult = await query(`SELECT rank FROM users WHERE id = $1`, [user.id]);
    const rank = userResult.rows[0]?.rank || 'user';

    if (!['moderator', 'admin', 'owner'].includes(rank)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { imageId, targetId, action, reason } = body;
    const finalImageId = imageId || targetId;
    const sequentialId = parseInt(finalImageId, 10);

    if (isNaN(sequentialId)) {
      return NextResponse.json({ success: false, error: 'Invalid image ID' }, { status: 400 });
    }

    const normalizedAction = action === 'undo' ? 'restore' : action;

    if (!['delete', 'unlist', 'restore'].includes(normalizedAction)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const imgResult = await query(`SELECT * FROM images WHERE sequential_id = $1`, [sequentialId]);
    if (imgResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Image not found' }, { status: 404 });
    }

    const image = imgResult.rows[0];
    const now = new Date();
    const reversibleUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    let prevState: any = null;
    if (normalizedAction === 'delete') {
      prevState = { deleted: image.deleted, deleted_at: image.deleted_at };
      await query(
        `UPDATE images SET deleted = TRUE, deleted_at = $1, deleted_by = $2,
         deleted_by_username = $3, deletion_reason = $4, deletion_reversible_until = $5,
         updated_at = NOW() WHERE id = $6`,
        [now, user.id, user.username, reason || null, reversibleUntil, image.id]
      );
    } else if (normalizedAction === 'unlist') {
      prevState = { unlisted: image.unlisted, unlisted_at: image.unlisted_at };
      await query(
        `UPDATE images SET unlisted = TRUE, unlisted_at = $1, unlisted_by = $2,
         unlisted_by_username = $3, unlist_reason = $4, unlist_reversible_until = $5,
         updated_at = NOW() WHERE id = $6`,
        [now, user.id, user.username, reason || null, reversibleUntil, image.id]
      );
    } else if (normalizedAction === 'restore') {
      prevState = { deleted: image.deleted, unlisted: image.unlisted };
      await query(
        `UPDATE images SET deleted = FALSE, unlisted = FALSE, restored_at = $1,
         restored_by = $2, restored_by_username = $3, updated_at = NOW() WHERE id = $4`,
        [now, user.id, user.username, image.id]
      );
    }

    // Log the moderation action
    await query(
      `INSERT INTO moderation_logs (
        action, target_type, target_id, performed_by, performed_by_username,
        reason, previous_state, reversible, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        normalizedAction,
        'image',
        image.id,
        user.id,
        user.username,
        reason || null,
        JSON.stringify(prevState),
        normalizedAction !== 'restore',
        now
      ]
    );

    return NextResponse.json({ success: true, message: `Image ${normalizedAction}d successfully` });
  } catch (error) {
    console.error('Moderation error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
