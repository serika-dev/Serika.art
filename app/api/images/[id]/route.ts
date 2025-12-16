import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    
    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const image = await collection.findOne({ sequentialId });

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    // Fetch tag data for display
    const tags = image.tags || [];
    let populatedTags: any[] = [];
    
    if (Array.isArray(tags) && tags.length > 0) {
      const tagDocs = await tagsCollection
        .find({ _id: { $in: tags } })
        .toArray();
      
      // Create a map for quick lookup
      const tagMap = new Map(tagDocs.map(t => [t._id.toString(), t]));
      
      // Populate tags in order
      populatedTags = tags.map(tagId => {
        const tag = tagMap.get(tagId.toString());
        return {
          _id: tagId,
          name: tag?.name || 'unknown',
          type: tag?.type || 'general',
        };
      });
    }

    // Increment view count
    await collection.updateOne(
      { sequentialId },
      { $inc: { views: 1 } }
    );

    return NextResponse.json({
      success: true,
      image: { ...image, tags: populatedTags, views: image.views + 1 },
    });
  } catch (error: any) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await request.json();

    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    
    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const image = await collection.findOne({ sequentialId });

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (image.userId && userId && image.userId.toString() !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await collection.deleteOne({ sequentialId });

    // Update tag counts
    const tags = image.tags || [];
    for (const tagId of tags) {
      await tagsCollection.updateOne(
        { _id: tagId },
        { $inc: { count: -1 } }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
