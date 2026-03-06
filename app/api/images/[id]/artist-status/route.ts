import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// Check if user can comment as artist on this image
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: true,
        canCommentAsArtist: false,
        artistTags: [],
      });
    }

    const { id } = await params;
    
    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    // Get the image and its tags
    const imagesCollection = await getCollection('images');
    const image = await imagesCollection.findOne({ sequentialId });
    
    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    // Get user's claimed and verified artist pages
    const artistsCollection = await getCollection('artists');
    const userArtists = await artistsCollection.find({
      claimedByUserId: new ObjectId(user.id),
      verified: true,
    }).toArray();

    if (userArtists.length === 0) {
      return NextResponse.json({
        success: true,
        canCommentAsArtist: false,
        artistTags: [],
      });
    }

    // Get the tag IDs from the image
    const imageTagIds = image.tags.map((t: any) => {
      if (typeof t === 'object' && t._id) return t._id.toString();
      return t.toString();
    });

    // Find which of the user's artist tags are on this image
    const matchingArtists = userArtists.filter(artist => 
      imageTagIds.includes(artist.tagId.toString())
    );

    if (matchingArtists.length === 0) {
      return NextResponse.json({
        success: true,
        canCommentAsArtist: false,
        artistTags: [],
      });
    }

    return NextResponse.json({
      success: true,
      canCommentAsArtist: true,
      artistTags: matchingArtists.map(artist => ({
        tagId: artist.tagId.toString(),
        tagName: artist.tagName,
      })),
    });
  } catch (error: any) {
    console.error('Error checking artist status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check artist status' },
      { status: 500 }
    );
  }
}
