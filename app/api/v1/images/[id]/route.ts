import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { ObjectId } from 'mongodb';

// GET /api/v1/images/[id] - Get single image details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return apiError('Invalid image ID', 400, 'INVALID_ID');
    }

    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    const commentsCollection = await getCollection('comments');

    const image = await collection.findOne({ _id: new ObjectId(id) });

    if (!image) {
      return apiError('Image not found', 404, 'NOT_FOUND');
    }

    // Get tags
    const tagDocs = await tagsCollection
      .find({ _id: { $in: image.tags || [] } })
      .toArray();
    const tagMap = new Map(tagDocs.map((t) => [t._id.toString(), t]));

    // Get comment count
    const commentCount = await commentsCollection.countDocuments({
      imageId: new ObjectId(id),
    });

    // Format response
    const formattedImage = {
      id: image._id.toString(),
      url: image.url,
      thumbnail_url: image.thumbnailUrl,
      original_filename: image.originalFilename,
      width: image.width,
      height: image.height,
      file_size: image.fileSize,
      content_type: image.contentType,
      rating: image.rating,
      is_ai_generated: image.isAIGenerated,
      source: image.source || null,
      description: image.description || null,
      tags: (image.tags || []).map((tagId: ObjectId) => {
        const tag = tagMap.get(tagId.toString());
        return tag ? { name: tag.name, type: tag.type } : null;
      }).filter(Boolean),
      stats: {
        upvotes: image.upvotes || 0,
        downvotes: image.downvotes || 0,
        favorites: image.favorites || 0,
        views: image.views || 0,
        score: (image.upvotes || 0) - (image.downvotes || 0),
        comments: commentCount,
      },
      user: {
        id: image.userId?.toString() || null,
        username: image.username || 'Anonymous',
      },
      created_at: image.createdAt,
      updated_at: image.updatedAt,
    };

    // Increment view count (don't wait)
    collection.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { views: 1 } }
    );

    return apiResponse(formattedImage);
  } catch (error: any) {
    console.error('API v1 image detail error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

// DELETE /api/v1/images/[id] - Delete an image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const validation = await validateApiKey(request, ['images:delete']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return apiError('Invalid image ID', 400, 'INVALID_ID');
    }

    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');

    const image = await collection.findOne({ _id: new ObjectId(id) });

    if (!image) {
      return apiError('Image not found', 404, 'NOT_FOUND');
    }

    // Check ownership (API key owner must match image owner or be admin)
    if (image.userId && validation.apiKey!.userId.toString() !== image.userId.toString()) {
      // Check if user is admin
      const usersCollection = await getCollection('users');
      const apiUser = await usersCollection.findOne({
        _id: validation.apiKey!.userId,
      });

      if (!apiUser || !['admin', 'owner'].includes(apiUser.rank)) {
        return apiError('Unauthorized to delete this image', 403, 'FORBIDDEN');
      }
    }

    // Decrement tag counts
    if (image.tags && image.tags.length > 0) {
      await tagsCollection.updateMany(
        { _id: { $in: image.tags } },
        { $inc: { count: -1 } }
      );
    }

    // Delete related data
    const votesCollection = await getCollection('votes');
    const favoritesCollection = await getCollection('favorites');
    const commentsCollection = await getCollection('comments');

    await Promise.all([
      collection.deleteOne({ _id: new ObjectId(id) }),
      votesCollection.deleteMany({ imageId: new ObjectId(id) }),
      favoritesCollection.deleteMany({ imageId: new ObjectId(id) }),
      commentsCollection.deleteMany({ imageId: new ObjectId(id) }),
    ]);

    return apiResponse({ deleted: true, id });
  } catch (error: any) {
    console.error('API v1 image delete error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
