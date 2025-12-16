import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ObjectId } from 'mongodb';

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

    if (!['upvote', 'downvote'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid vote type' },
        { status: 400 }
      );
    }

    const votesCollection = await getCollection('votes');
    const imagesCollection = await getCollection('images');

    // Get the image by sequential ID
    const image = await imagesCollection.findOne({ sequentialId });
    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    const imageObjectId = image._id;
    const userObjectId = new ObjectId(user.id);

    // Check if user already voted
    const existingVote = await votesCollection.findOne({
      userId: userObjectId,
      imageId: imageObjectId,
    });

    if (existingVote) {
      // If same vote, remove it
      if (existingVote.type === type) {
        await votesCollection.deleteOne({ _id: existingVote._id });
        await imagesCollection.updateOne(
          { _id: imageObjectId },
          { $inc: { [type === 'upvote' ? 'upvotes' : 'downvotes']: -1 } }
        );
        return NextResponse.json({
          success: true,
          action: 'removed',
        });
      } else {
        // Change vote
        await votesCollection.updateOne(
          { _id: existingVote._id },
          { $set: { type, createdAt: new Date() } }
        );
        await imagesCollection.updateOne(
          { _id: imageObjectId },
          {
            $inc: {
              [existingVote.type === 'upvote' ? 'upvotes' : 'downvotes']: -1,
              [type === 'upvote' ? 'upvotes' : 'downvotes']: 1,
            },
          }
        );
        return NextResponse.json({
          success: true,
          action: 'changed',
        });
      }
    }

    // Add new vote
    await votesCollection.insertOne({
      userId: userObjectId,
      imageId: imageObjectId,
      type,
      createdAt: new Date(),
    });

    await imagesCollection.updateOne(
      { _id: imageObjectId },
      { $inc: { [type === 'upvote' ? 'upvotes' : 'downvotes']: 1 } }
    );

    return NextResponse.json({
      success: true,
      action: 'added',
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
