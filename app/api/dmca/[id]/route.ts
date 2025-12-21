import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';

// PATCH /api/dmca/[id] - Update DMCA request status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check auth
    const user = await getCurrentUser();
    
    if (!user || !['admin', 'owner'].includes(user.rank || '')) {
      return NextResponse.json({ success: false, error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const { status, note, affectedImageIds } = body;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid request ID' }, { status: 400 });
    }

    const collection = await getCollection('dmca_requests');
    
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
      updateData.reviewedBy = new ObjectId(user.id);
      updateData.reviewedAt = new Date();
    }

    if (affectedImageIds) {
      updateData.affectedImageIds = affectedImageIds.map((id: string) => new ObjectId(id));
    }

    // Add note if provided
    if (note) {
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: updateData,
          $push: { 
            notes: {
              text: note,
              addedBy: new ObjectId(user.id),
              addedByUsername: user.username,
              addedAt: new Date()
            }
          } as any
        }
      );
    } else {
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
    }

    // If approved, handle the affected images
    if (status === 'approved' && affectedImageIds?.length > 0) {
      const imagesCollection = await getCollection('images');
      const modLogCollection = await getCollection('moderation_logs');

      for (const imageId of affectedImageIds) {
        // Log the action
        await modLogCollection.insertOne({
          action: 'dmca_takedown',
          targetType: 'image',
          targetId: new ObjectId(imageId),
          performedBy: new ObjectId(user.id),
          performedByUsername: user.username,
          reason: `DMCA Request #${id}`,
          dmcaRequestId: new ObjectId(id),
          previousState: null,
          reversible: false, // DMCA takedowns are not reversible by mods
          createdAt: new Date(),
        });

        // Soft delete the image
        await imagesCollection.updateOne(
          { _id: new ObjectId(imageId) },
          { 
            $set: { 
              deleted: true,
              deletedAt: new Date(),
              deletedBy: new ObjectId(user.id),
              deletionReason: 'DMCA Takedown',
              dmcaRequestId: new ObjectId(id)
            }
          }
        );
      }
    }

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
    
    // Check auth
    const user = await getCurrentUser();
    
    if (!user || !['admin', 'owner', 'moderator'].includes(user.rank || '')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid request ID' }, { status: 400 });
    }

    const collection = await getCollection('dmca_requests');
    const dmcaRequest = await collection.findOne({ _id: new ObjectId(id) });

    if (!dmcaRequest) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: dmcaRequest });
  } catch (error) {
    console.error('DMCA fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch request' }, { status: 500 });
  }
}
