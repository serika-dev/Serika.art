import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';

// POST /api/moderation/action - Perform moderation action
export async function POST(request: NextRequest) {
  try {
    // Check auth
    const user = await getCurrentUser();
    
    if (!user || !['admin', 'owner', 'moderator'].includes(user.rank || '')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, targetType, targetId, reason } = body;

    const validActions = ['delete', 'unlist', 'restore', 'undo'];
    const validTargetTypes = ['image', 'comment', 'user'];

    if (!validActions.includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    if (!validTargetTypes.includes(targetType)) {
      return NextResponse.json({ success: false, error: 'Invalid target type' }, { status: 400 });
    }

    if (!ObjectId.isValid(targetId)) {
      return NextResponse.json({ success: false, error: 'Invalid target ID' }, { status: 400 });
    }

    const modLogCollection = await getCollection('moderation_logs');
    const isAdmin = ['admin', 'owner'].includes(user.rank || '');

    // Handle image actions
    if (targetType === 'image') {
      const imagesCollection = await getCollection('images');
      const image = await imagesCollection.findOne({ _id: new ObjectId(targetId) });
      
      if (!image) {
        return NextResponse.json({ success: false, error: 'Image not found' }, { status: 404 });
      }

      // Store previous state for potential undo
      const previousState = {
        deleted: image.deleted || false,
        unlisted: image.unlisted || false,
      };

      let updateData: any = {};
      let logAction = action;

      switch (action) {
        case 'delete':
          updateData = {
            deleted: true,
            deletedAt: new Date(),
            deletedBy: new ObjectId(user.id),
            deletedByUsername: user.username,
            deletionReason: reason || 'Moderation action',
            // Moderator deletions are reversible within 1 week
            deletionReversibleUntil: isAdmin ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          };
          break;

        case 'unlist':
          updateData = {
            unlisted: true,
            unlistedAt: new Date(),
            unlistedBy: new ObjectId(user.id),
            unlistedByUsername: user.username,
            unlistReason: reason || 'Moderation action',
            unlistReversibleUntil: isAdmin ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          };
          break;

        case 'restore':
          // Only admin can restore DMCA takedowns
          if (image.dmcaRequestId && !isAdmin) {
            return NextResponse.json({ 
              success: false, 
              error: 'Only admins can restore DMCA takedowns' 
            }, { status: 403 });
          }
          
          updateData = {
            deleted: false,
            deletedAt: null,
            deletedBy: null,
            deletedByUsername: null,
            deletionReason: null,
            deletionReversibleUntil: null,
            unlisted: false,
            unlistedAt: null,
            unlistedBy: null,
            unlistedByUsername: null,
            unlistReason: null,
            unlistReversibleUntil: null,
            restoredAt: new Date(),
            restoredBy: new ObjectId(user.id),
            restoredByUsername: user.username,
          };
          break;

        case 'undo':
          // Check if action is within the reversible window
          const lastLog = await modLogCollection.findOne(
            { 
              targetId: new ObjectId(targetId),
              performedBy: new ObjectId(user.id),
              reversible: true,
              undone: { $ne: true }
            },
            { sort: { createdAt: -1 } }
          );

          if (!lastLog) {
            return NextResponse.json({ 
              success: false, 
              error: 'No reversible action found' 
            }, { status: 400 });
          }

          // Check if still within the 1 week window
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          if (lastLog.createdAt < weekAgo && !isAdmin) {
            return NextResponse.json({ 
              success: false, 
              error: 'Action can no longer be undone (past 1 week window)' 
            }, { status: 400 });
          }

          // Restore previous state
          updateData = lastLog.previousState || {
            deleted: false,
            unlisted: false,
          };
          logAction = `undo_${lastLog.action}`;

          // Mark the original log as undone
          await modLogCollection.updateOne(
            { _id: lastLog._id },
            { $set: { undone: true, undoneAt: new Date(), undoneBy: new ObjectId(user.id) } }
          );
          break;
      }

      await imagesCollection.updateOne(
        { _id: new ObjectId(targetId) },
        { $set: updateData }
      );

      // Log the moderation action
      await modLogCollection.insertOne({
        action: logAction,
        targetType,
        targetId: new ObjectId(targetId),
        performedBy: new ObjectId(user.id),
        performedByUsername: user.username,
        performedByRank: user.rank,
        reason: reason || null,
        previousState,
        reversible: !isAdmin && ['delete', 'unlist'].includes(action),
        undone: false,
        createdAt: new Date(),
      });

      return NextResponse.json({ 
        success: true, 
        message: `Image ${action}d successfully`,
        reversible: !isAdmin && ['delete', 'unlist'].includes(action),
        reversibleUntil: !isAdmin && ['delete', 'unlist'].includes(action) 
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
          : null
      });
    }

    return NextResponse.json({ success: false, error: 'Action not implemented for this target type' }, { status: 400 });
  } catch (error) {
    console.error('Moderation action error:', error);
    return NextResponse.json({ success: false, error: 'Failed to perform action' }, { status: 500 });
  }
}

// GET /api/moderation/action - Get moderation logs
export async function GET(request: NextRequest) {
  try {
    // Check auth
    const user = await getCurrentUser();
    
    if (!user || !['admin', 'owner', 'moderator'].includes(user.rank || '')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const targetId = searchParams.get('targetId');
    const performedBy = searchParams.get('performedBy');
    const action = searchParams.get('action');

    const modLogCollection = await getCollection('moderation_logs');
    
    const query: any = {};
    if (targetId && ObjectId.isValid(targetId)) {
      query.targetId = new ObjectId(targetId);
    }
    if (performedBy && ObjectId.isValid(performedBy)) {
      query.performedBy = new ObjectId(performedBy);
    }
    if (action) {
      query.action = action;
    }

    const total = await modLogCollection.countDocuments(query);
    const logs = await modLogCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Moderation logs error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch logs' }, { status: 500 });
  }
}
