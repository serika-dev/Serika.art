import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// Update tag type (admin+ only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user rank from local DB
    const usersCollection = await getCollection('users');
    const userDoc = await usersCollection.findOne({ _id: new ObjectId(user.id) });
    
    const rank = userDoc?.rank || 'user';
    
    // Only admin and owner can change tag types
    if (rank !== 'admin' && rank !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Admin+ required.' },
        { status: 403 }
      );
    }

    const { name } = await params;
    const { type } = await request.json();

    if (!['general', 'artist', 'character', 'copyright', 'meta'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tag type' },
        { status: 400 }
      );
    }

    const tagsCollection = await getCollection('tags');
    const result = await tagsCollection.updateOne(
      { name: name.toLowerCase() },
      { $set: { type } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Update all images with this tag
    const imagesCollection = await getCollection('images');
    await imagesCollection.updateMany(
      { 'tags.name': name.toLowerCase() },
      { $set: { 'tags.$[tag].type': type } },
      { arrayFilters: [{ 'tag.name': name.toLowerCase() }] }
    );

    return NextResponse.json({
      success: true,
      message: 'Tag type updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update tag' },
      { status: 500 }
    );
  }
}
