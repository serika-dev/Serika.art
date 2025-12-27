import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { ObjectId } = await import('mongodb');
    
    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const imagesCollection = await getCollection('images');
    const image = await imagesCollection.findOne({ sequentialId });
    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }
    
    const commentsCollection = await getCollection('comments');
    const comments = await commentsCollection
      .find({ imageId: image._id })
      .sort({ createdAt: 1 })
      .toArray();
    
    // Get artist info for comments marked as artist
    const artistTagIds = comments
      .filter(c => c.asArtist && c.artistTagId)
      .map(c => c.artistTagId);
    
    let artistTagNames: Record<string, string> = {};
    if (artistTagIds.length > 0) {
      const tagsCollection = await getCollection('tags');
      const tags = await tagsCollection.find({ _id: { $in: artistTagIds } }).toArray();
      artistTagNames = tags.reduce((acc, tag) => {
        acc[tag._id.toString()] = tag.name;
        return acc;
      }, {} as Record<string, string>);
    }
    
    return NextResponse.json({
      success: true,
      comments: comments.map(c => ({
        _id: c._id.toString(),
        imageId: c.imageId.toString(),
        userId: c.userId.toString(),
        username: c.username,
        avatarUrl: c.avatarUrl,
        rank: c.rank || 'user',
        content: c.content,
        parentId: c.parentId?.toString(),
        asArtist: c.asArtist || false,
        artistTagName: c.artistTagId ? artistTagNames[c.artistTagId.toString()] : undefined,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to comment' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { content, parentId, asArtist, artistTagId } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment cannot be empty' },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Comment is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    const { ObjectId } = await import('mongodb');
    
    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const imagesCollection = await getCollection('images');
    const image = await imagesCollection.findOne({ sequentialId });
    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }
    
    // Get user details
    const usersCollection = await getCollection('users');
    const userDoc = await usersCollection.findOne({ _id: new ObjectId(user.id) });
    
    if (!userDoc) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Validate asArtist claim
    let validatedArtistTagId: ObjectId | undefined;
    if (asArtist && artistTagId) {
      // Check if user owns this artist page
      const artistsCollection = await getCollection('artists');
      const artist = await artistsCollection.findOne({
        tagId: new ObjectId(artistTagId),
        claimedByUserId: new ObjectId(user.id),
        verified: true,
      });

      if (!artist) {
        return NextResponse.json(
          { success: false, error: 'You are not verified as this artist' },
          { status: 403 }
        );
      }

      // Check if the image has this artist tag
      const imageHasTag = image.tags.some((t: any) => 
        t.toString() === artistTagId || 
        (t._id && t._id.toString() === artistTagId)
      );

      if (!imageHasTag) {
        return NextResponse.json(
          { success: false, error: 'This image is not tagged with your artist tag' },
          { status: 400 }
        );
      }

      validatedArtistTagId = new ObjectId(artistTagId);
    }

    // Create comment
    const commentsCollection = await getCollection('comments');
    const comment = {
      imageId: image._id,
      userId: new ObjectId(user.id),
      username: userDoc.username,
      avatarUrl: userDoc.avatarUrl,
      rank: userDoc.rank || 'user',
      content: content.trim(),
      parentId: parentId ? new ObjectId(parentId) : undefined,
      asArtist: asArtist && validatedArtistTagId ? true : false,
      artistTagId: validatedArtistTagId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await commentsCollection.insertOne(comment);

    // Get artist tag name if applicable
    let artistTagName: string | undefined;
    if (validatedArtistTagId) {
      const tagsCollection = await getCollection('tags');
      const tag = await tagsCollection.findOne({ _id: validatedArtistTagId });
      artistTagName = tag?.name;
    }

    return NextResponse.json({
      success: true,
      comment: {
        _id: result.insertedId.toString(),
        imageId: comment.imageId.toString(),
        userId: comment.userId.toString(),
        username: comment.username,
        avatarUrl: comment.avatarUrl,
        rank: comment.rank,
        content: comment.content,
        parentId: comment.parentId?.toString(),
        asArtist: comment.asArtist,
        artistTagName,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
