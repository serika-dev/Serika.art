import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { uploadToR2 } from '@/lib/r2';
import { uploadLocally } from '@/lib/localStorage';
import { ObjectId } from 'mongodb';
import sharp from 'sharp';

const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';

// POST /api/v1/upload - Upload an image via API
export async function POST(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['upload']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tagsString = formData.get('tags') as string;
    const rating = formData.get('rating') as 'safe' | 'questionable' | 'explicit';
    const isAIGenerated = formData.get('is_ai_generated') === 'true' || formData.get('isAIGenerated') === 'true';
    const source = formData.get('source') as string || '';
    const description = formData.get('description') as string || '';

    // Validate file
    if (!file) {
      return apiError('No file provided', 400, 'MISSING_FILE');
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return apiError(
        `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
        400,
        'INVALID_FILE_TYPE'
      );
    }

    // Check file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return apiError('File too large. Maximum size is 50MB', 400, 'FILE_TOO_LARGE');
    }

    // Parse tags
    let tagsData: { name: string; type: string }[] = [];
    try {
      if (tagsString) {
        const parsed = JSON.parse(tagsString);
        if (Array.isArray(parsed)) {
          tagsData = parsed.map((t: any) => ({
            name: typeof t === 'string' ? t : t.name,
            type: typeof t === 'string' ? 'general' : t.type || 'general',
          }));
        }
      }
    } catch {
      // Fallback to comma-separated format
      if (tagsString) {
        tagsData = tagsString.split(',').map((t) => ({
          name: t.trim().toLowerCase(),
          type: 'general',
        })).filter((t) => t.name);
      }
    }

    if (tagsData.length === 0) {
      return apiError('At least one tag is required', 400, 'MISSING_TAGS');
    }

    if (tagsData.length > 100) {
      return apiError('Maximum 100 tags allowed', 400, 'TOO_MANY_TAGS');
    }

    // Validate rating
    if (!['safe', 'questionable', 'explicit'].includes(rating)) {
      return apiError(
        'Invalid rating. Must be: safe, questionable, or explicit',
        400,
        'INVALID_RATING'
      );
    }

    // Resolve tags to ObjectIDs
    const tagsCollection = await getCollection('tags');
    const tagIds: ObjectId[] = [];

    for (const tagInfo of tagsData) {
      const normalizedName = tagInfo.name.toLowerCase().replace(/\s+/g, '_');
      let tag = await tagsCollection.findOne({ name: normalizedName });

      if (!tag) {
        const validTypes = ['general', 'artist', 'character', 'copyright', 'meta'];
        const tagType = validTypes.includes(tagInfo.type) ? tagInfo.type : 'general';

        const result = await tagsCollection.insertOne({
          name: normalizedName,
          type: tagType,
          count: 0,
          createdAt: new Date(),
        });
        tagIds.push(result.insertedId);
      } else {
        tagIds.push(tag._id);
      }
    }

    // Process image
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get metadata
    const metadata = await sharp(buffer).metadata();

    // Create thumbnail
    const thumbnailBuffer = await sharp(buffer)
      .resize(320, 320, { fit: 'cover' })
      .jpeg({ quality: 45, mozjpeg: true, progressive: true })
      .toBuffer();

    // Upload to storage
    let imageUrl: string;
    let thumbnailUrl: string;

    try {
      if (USE_LOCAL_STORAGE) {
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
      console.error('Upload error:', uploadError);
      return apiError('Failed to upload file', 500, 'UPLOAD_FAILED');
    }

    // Create image document
    const imagesCollection = await getCollection('images');
    const usersCollection = await getCollection('users');

    // Get user info
    const user = await usersCollection.findOne({ _id: validation.apiKey!.userId });

    // Get the next sequential ID
    const lastImage = await imagesCollection.findOne({}, { sort: { sequentialId: -1 } });
    const nextSequentialId = lastImage?.sequentialId ? lastImage.sequentialId + 1 : 1;

    const imageDoc = {
      sequentialId: nextSequentialId,
      userId: validation.apiKey!.userId,
      username: user?.username || validation.apiKey!.username,
      url: imageUrl,
      thumbnailUrl,
      originalFilename: file.name,
      fileSize: file.size,
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

    const result = await imagesCollection.insertOne(imageDoc);

    // Update tag counts
    await tagsCollection.updateMany(
      { _id: { $in: tagIds } },
      { $inc: { count: 1 } }
    );

    // Get tag names for response
    const tagDocs = await tagsCollection.find({ _id: { $in: tagIds } }).toArray();

    return apiResponse({
      id: result.insertedId.toString(),
      sequential_id: nextSequentialId,
      url: imageUrl,
      thumbnail_url: thumbnailUrl,
      width: metadata.width || 0,
      height: metadata.height || 0,
      file_size: file.size,
      content_type: file.type,
      rating,
      is_ai_generated: isAIGenerated,
      tags: tagDocs.map((t) => ({ name: t.name, type: t.type })),
      created_at: imageDoc.createdAt,
    }, {
      message: 'Image uploaded successfully',
    });
  } catch (error: any) {
    console.error('API v1 upload error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
