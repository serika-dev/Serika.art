import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PATCH /api/dmca/[id] - Update DMCA request status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ success: false, error: 'Invalid request ID' }, { status: 400 });
    }

    // Check auth
    const user = await getCurrentUser();
    if (!user || !['admin', 'owner'].includes(user.rank || '')) {
      return NextResponse.json({ success: false, error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const { status, note, affectedImageIds } = body;

    // Fetch existing request
    const existing = await query(`SELECT * FROM dmca_requests WHERE id = $1`, [requestId]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }
    const dmcaReq = existing.rows[0];

    await withTransaction(async (client) => {
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let pIdx = 1;

      if (status) {
        setClauses.push(`status = $${pIdx}`);
        params.push(status);
        pIdx++;

        setClauses.push(`reviewed_by = $${pIdx}`);
        params.push(user.id);
        pIdx++;

        setClauses.push(`reviewed_by_username = $${pIdx}`);
        params.push(user.username);
        pIdx++;

        setClauses.push(`reviewed_at = NOW()`);
      }

      if (affectedImageIds && Array.isArray(affectedImageIds)) {
        setClauses.push(`affected_image_ids = $${pIdx}`);
        params.push(JSON.stringify(affectedImageIds.map(Number)));
        pIdx++;
      }

      if (note) {
        const currentNotes = dmcaReq.notes || [];
        const newNote = {
          text: note,
          addedBy: user.id,
          addedByUsername: user.username,
          addedAt: new Date().toISOString()
        };
        const updatedNotes = [...currentNotes, newNote];

        setClauses.push(`notes = $${pIdx}`);
        params.push(JSON.stringify(updatedNotes));
        pIdx++;
      }

      if (params.length > 0) {
        await client.query(
          `UPDATE dmca_requests SET ${setClauses.join(', ')} WHERE id = $${pIdx}`,
          [...params, requestId]
        );
      }

      // If approved, handle the affected images
      if (status === 'approved' && affectedImageIds && Array.isArray(affectedImageIds) && affectedImageIds.length > 0) {
        for (const rawImageId of affectedImageIds) {
          const imgSeqId = parseInt(rawImageId, 10);
          if (isNaN(imgSeqId)) continue;

          // Find the image by sequential_id or db id
          const imgResult = await client.query(
            `SELECT id, sequential_id FROM images WHERE id = $1 OR sequential_id = $1`,
            [imgSeqId]
          );

          if (imgResult.rows.length > 0) {
            const dbImage = imgResult.rows[0];

            // Log the action
            await client.query(
              `INSERT INTO moderation_logs (action, target_type, target_id, performed_by,
               performed_by_username, reason, dmca_request_id, previous_state, reversible, created_at)
               VALUES ('dmca_takedown', 'image', $1, $2, $3, $4, $5, NULL, FALSE, NOW())`,
              [dbImage.id, user.id, user.username, `DMCA Request #${requestId}`, requestId]
            );

            // Soft delete the image
            await client.query(
              `UPDATE images SET deleted = TRUE, deleted_at = NOW(), deleted_by = $1,
               deleted_by_username = $2, deletion_reason = 'DMCA Takedown', dmca_request_id = $3
               WHERE id = $4`,
              [user.id, user.username, requestId, dbImage.id]
            );
          }
        }
      }
    });

    return NextResponse.json({ success: true, message: 'Request updated' });
  } catch (error) {
    console.error('DMCA update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update request' }, { status: 500 });
  }
}

// GET /api/dmca/[id] - Get single DMCA request (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ success: false, error: 'Invalid request ID' }, { status: 400 });
    }

    // Check auth
    const user = await getCurrentUser();
    if (!user || !['admin', 'owner', 'moderator'].includes(user.rank || '')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const result = await query(`SELECT * FROM dmca_requests WHERE id = $1`, [requestId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    const dmcaRequest = result.rows[0];

    // Format fields for response compatibility
    const formattedRequest = {
      ...dmcaRequest,
      _id: String(dmcaRequest.id),
      id: dmcaRequest.id,
      affectedImageIds: dmcaRequest.affected_image_ids || [],
      notes: dmcaRequest.notes || [],
      reviewedBy: dmcaRequest.reviewed_by,
      reviewedAt: dmcaRequest.reviewed_at,
      createdAt: dmcaRequest.created_at,
      updatedAt: dmcaRequest.updated_at,
    };

    return NextResponse.json({ success: true, request: formattedRequest });
  } catch (error) {
    console.error('DMCA fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch request' }, { status: 500 });
  }
}
