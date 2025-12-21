import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth, getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const favoritesCollection = await getCollection('favorites');
    const imagesCollection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    const userObjectId = new ObjectId(user.id);

    // Get user's favorited image IDs
    const favorites = await favoritesCollection
      .find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .toArray();

    const imageIds = favorites.map(f => f.imageId);

    // Fetch the actual images
    const images = await imagesCollection
      .find({ _id: { $in: imageIds } })
      .toArray();

    // Populate tags for all images
    const allTagIds = new Set<string>();
    images.forEach(img => {
      if (Array.isArray(img.tags)) {
        img.tags.forEach((tagId: any) => allTagIds.add(tagId.toString()));
      }
    });

    let tagMap = new Map();
    if (allTagIds.size > 0) {
      const tagDocs = await tagsCollection
        .find({ _id: { $in: Array.from(allTagIds).map(id => new ObjectId(id)) } })
        .toArray();
      tagMap = new Map(tagDocs.map(t => [t._id.toString(), t]));
    }

    // Map images to replace tag IDs with populated tag data
    const populatedImages = images.map((img: any) => ({
      ...img,
      tags: (img.tags || []).map((tagId: any) => {
        const tag = tagMap.get(tagId.toString());
        return {
          _id: tagId,
          name: tag?.name || 'unknown',
          type: tag?.type || 'general',
          count: tag?.count || 0,
        };
      }),
    }));

    return NextResponse.json({
      success: true,
      favorites: populatedImages,
    });
  } catch (error: any) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { imageId } = await request.json();

    const sequentialId = parseInt(imageId, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const favoritesCollection = await getCollection('favorites');
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

    // Check if already favorited
    const existingFavorite = await favoritesCollection.findOne({
      userId: userObjectId,
      imageId: imageObjectId,
    });

    if (existingFavorite) {
      // Remove favorite
      await favoritesCollection.deleteOne({ _id: existingFavorite._id });
      await imagesCollection.updateOne(
        { _id: imageObjectId },
        { $inc: { favorites: -1 } }
      );
      return NextResponse.json({
        success: true,
        action: 'removed',
      });
    }

    // Add favorite
    await favoritesCollection.insertOne({
      userId: userObjectId,
      imageId: imageObjectId,
      createdAt: new Date(),
    });

    await imagesCollection.updateOne(
      { _id: imageObjectId },
      { $inc: { favorites: 1 } }
    );

    return NextResponse.json({
      success: true,
      action: 'added',
    });
  } catch (error: any) {
    console.error('Error toggling favorite:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to favorite images' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}
