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
      image: { 
        ...image, 
        dbid: image._id.toString(),
        post_id: image.sequentialId,
        tags: populatedTags, 
        views: image.views + 1 
      },
    });
  } catch (error: any) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, userRank, tags: newTags, description, source, rating, isAIGenerated } = body;

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

    // Check authorization: poster or moderator+
    const isPoster = image.userId && userId && image.userId.toString() === userId;
    const isModerator = userRank && ['moderator', 'admin', 'owner'].includes(userRank);
    
    if (!isPoster && !isModerator) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Prepare update object
    const updateFields: any = {
      updatedAt: new Date(),
    };

    // Handle tags update if provided
    if (newTags && Array.isArray(newTags)) {
      // Resolve tag names to ObjectIDs
      const tagIds: ObjectId[] = [];
      
      for (const tagInfo of newTags) {
        let tag = await tagsCollection.findOne({ name: tagInfo.name.toLowerCase() });
        if (!tag) {
          const result = await tagsCollection.insertOne({
            name: tagInfo.name.toLowerCase(),
            type: tagInfo.type || 'general',
            count: 0,
            createdAt: new Date(),
          });
          tagIds.push(result.insertedId);
        } else {
          tagIds.push(tag._id);
        }
      }

      // Update tag counts
      const oldTags = image.tags || [];
      
      // Decrement counts for removed tags
      for (const tagId of oldTags) {
        if (!tagIds.some(newId => newId.toString() === tagId.toString())) {
          await tagsCollection.updateOne(
            { _id: tagId },
            { $inc: { count: -1 } }
          );
        }
      }
      
      // Increment counts for added tags
      for (const tagId of tagIds) {
        if (!oldTags.some((oldId: ObjectId) => oldId.toString() === tagId.toString())) {
          await tagsCollection.updateOne(
            { _id: tagId },
            { $inc: { count: 1 } }
          );
        }
      }

      updateFields.tags = tagIds;
    }

    // Update other fields if provided
    if (description !== undefined) {
      updateFields.description = description;
    }
    if (source !== undefined) {
      updateFields.source = source;
    }
    if (rating !== undefined && ['safe', 'questionable', 'explicit'].includes(rating)) {
      updateFields.rating = rating;
    }
    if (isAIGenerated !== undefined) {
      updateFields.isAIGenerated = isAIGenerated;
    }

    await collection.updateOne(
      { sequentialId },
      { $set: updateFields }
    );

    return NextResponse.json({
      success: true,
      message: 'Image updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update image' },
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
