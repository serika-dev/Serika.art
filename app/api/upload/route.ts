import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { uploadToR2 } from '@/lib/r2';
import { uploadLocally } from '@/lib/localStorage';
import { requireAuth } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import sharp from 'sharp';

const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';

export async function POST(request: NextRequest) {
  try {
    // Try to get user, but allow anonymous uploads
    let user: any = null;
    try {
      const { getCurrentUser } = await import('@/lib/auth');
      user = await getCurrentUser();
    } catch {
      // Anonymous upload
    }
    
    // If user exists, ensure they're in local DB
    if (user) {
      const usersCollection = await getCollection('users');
      let rank: 'user' | 'moderator' | 'admin' | 'owner' = 'user';
      if (user.id === '692ad0df032c62f79b57a08d') {
        rank = 'owner';
      }
      
      await usersCollection.updateOne(
        { _id: new ObjectId(user.id) },
        {
          $set: {
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl || '',
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
            rank,
          },
        },
        { upsert: true }
      );
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tagsString = formData.get('tags') as string;
    let tagsData = [];
    try {
      tagsData = JSON.parse(tagsString);
    } catch {
      // Fallback to old format for backward compatibility
      tagsData = tagsString?.split(',').map(t => ({ name: t.trim(), type: 'general' })).filter(t => t.name) || [];
    }
    const rating = formData.get('rating') as 'safe' | 'questionable' | 'explicit';
    const isAIGenerated = formData.get('isAIGenerated') === 'true';
    const postAnonymously = formData.get('postAnonymously') === 'true';
    const source = formData.get('source') as string || '';
    const description = formData.get('description') as string || '';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (tagsData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one tag is required' },
        { status: 400 }
      );
    }

    if (!['safe', 'questionable', 'explicit'].includes(rating)) {
      return NextResponse.json(
        { success: false, error: 'Invalid rating' },
        { status: 400 }
      );
    }

    // Resolve tag names to ObjectIDs
    const tagsCollection = await getCollection('tags');
    const tagIds: ObjectId[] = [];
    
    for (const tagInfo of tagsData) {
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

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get image metadata
    const metadata = await sharp(buffer).metadata();

    // Create aggressively compressed thumbnail for fast previews
    const thumbnailBuffer = await sharp(buffer)
      .resize(320, 320, { fit: 'cover' })
      .jpeg({ quality: 45, mozjpeg: true, progressive: true })
      .toBuffer();

    // Upload to storage (R2 or local fallback)
    let imageUrl: string;
    let thumbnailUrl: string;
    
    try {
      if (USE_LOCAL_STORAGE) {
        console.log('Using local storage for uploads...');
        [imageUrl, thumbnailUrl] = await Promise.all([
          uploadLocally(buffer, file.name, file.type),
          uploadLocally(thumbnailBuffer, `thumb-${file.name}`, 'image/jpeg', 'thumbnails'),
        ]);
      } else {
        [imageUrl, thumbnailUrl] = await Promise.all([
          uploadToR2(buffer, file.name, file.type),
          uploadToR2(thumbnailBuffer, `thumb-${file.name}`, 'image/jpeg', 'thumbnails'),
        ]);
      }
    } catch (uploadError: any) {
      console.error('Primary upload failed, trying fallback:', uploadError);
      
      // Fallback to local storage if R2 fails
      if (!USE_LOCAL_STORAGE) {
        console.log('R2 upload failed, falling back to local storage...');
        try {
          [imageUrl, thumbnailUrl] = await Promise.all([
            uploadLocally(buffer, file.name, file.type),
            uploadLocally(thumbnailBuffer, `thumb-${file.name}`, 'image/jpeg', 'thumbnails'),
          ]);
        } catch (fallbackError) {
          throw new Error('Both R2 and local storage uploads failed. Please check your configuration.');
        }
      } else {
        throw uploadError;
      }
    }

    const collection = await getCollection('images');
    
    // Get the next sequential ID
    const lastImage = await collection.findOne({}, { sort: { sequentialId: -1 } });
    const nextSequentialId = lastImage?.sequentialId ? lastImage.sequentialId + 1 : 1;
    
    // Create image document
    const imageDoc = {
      sequentialId: nextSequentialId,
      userId: (user && !postAnonymously) ? new ObjectId(user.id) : null,
      username: (user && !postAnonymously) ? user.username : 'Anonymous',
      url: imageUrl,
      thumbnailUrl,
      originalFilename: file.name,
      fileSize: buffer.length,
      width: metadata.width || 0,
      height: metadata.height || 0,
      contentType: file.type,
      tags: tagIds,
      rating,
      isAIGenerated,
      source,
      description,
      upvotes: 0,
      downvotes: 0,
      favorites: 0,
      views: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(imageDoc);

    // Update tag counts
    for (const tagId of tagIds) {
      await tagsCollection.updateOne(
        { _id: tagId },
        { $inc: { count: 1 } }
      );
    }

    return NextResponse.json({
      success: true,
      image: { ...imageDoc, _id: result.insertedId },
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to upload images' },
        { status: 401 }
      );
    }

    // Provide more specific error messages
    let errorMessage = 'Failed to upload image';
    
    if (error.message?.includes('R2') || error.message?.includes('SSL') || error.code === 'EPROTO') {
      errorMessage = 'Failed to upload to storage. Please check your R2 configuration or try again later.';
    } else if (error.message?.includes('MongoDB') || error.message?.includes('connection')) {
      errorMessage = 'Database connection error. Please try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
