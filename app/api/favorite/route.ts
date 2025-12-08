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

    return NextResponse.json({
      success: true,
      favorites: images,
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

    if (!ObjectId.isValid(imageId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const favoritesCollection = await getCollection('favorites');
    const imagesCollection = await getCollection('images');

    const imageObjectId = new ObjectId(imageId);
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
