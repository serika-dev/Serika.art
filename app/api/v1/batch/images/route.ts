import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { ObjectId } from 'mongodb';

// POST /api/v1/batch/images - Get multiple images by IDs in a single request
export async function POST(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return apiError('ids must be a non-empty array', 400, 'INVALID_REQUEST');
    }

    if (ids.length > 100) {
      return apiError('Maximum 100 IDs per request', 400, 'TOO_MANY_IDS');
    }

    // Convert and validate IDs
    const objectIds: ObjectId[] = [];
    for (const id of ids) {
      try {
        objectIds.push(new ObjectId(id));
      } catch {
        // Skip invalid IDs
      }
    }

    if (objectIds.length === 0) {
      return apiError('No valid IDs provided', 400, 'INVALID_IDS');
    }

    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    const usersCollection = await getCollection('users');

    const images = await collection
      .find({ _id: { $in: objectIds } })
      .toArray();

    // Get all tag IDs
    const allTagIds = new Set<string>();
    images.forEach((img) => {
      (img.tags || []).forEach((tagId: ObjectId) => allTagIds.add(tagId.toString()));
    });

    const tagDocs = await tagsCollection
      .find({ _id: { $in: Array.from(allTagIds).map((id) => new ObjectId(id)) } })
      .toArray();
    const tagMap = new Map(tagDocs.map((t) => [t._id.toString(), t]));

    // Get all user IDs
    const userIds = [...new Set(images.map((img) => img.userId?.toString()).filter(Boolean))];
    const userDocs = await usersCollection
      .find({ _id: { $in: userIds.map((id) => new ObjectId(id)) } })
      .toArray();
    const userMap = new Map(userDocs.map((u) => [u._id.toString(), u]));

    const formattedImages = images.map((img) => {
      const user = img.userId ? userMap.get(img.userId.toString()) : null;
      return {
        id: img._id.toString(),
        sequential_id: img.sequentialId,
        url: img.url,
        thumbnail_url: img.thumbnailUrl,
        width: img.width,
        height: img.height,
        file_size: img.fileSize,
        content_type: img.contentType,
        rating: img.rating,
        is_ai_generated: img.isAIGenerated || false,
        source: img.source,
        description: img.description,
        tags: (img.tags || []).map((tagId: ObjectId) => {
          const tag = tagMap.get(tagId.toString());
          return tag ? { name: tag.name, type: tag.type } : null;
        }).filter(Boolean),
        stats: {
          upvotes: img.upvotes || 0,
          downvotes: img.downvotes || 0,
          favorites: img.favorites || 0,
          views: img.views || 0,
        },
        user: user ? {
          id: user._id.toString(),
          username: user.username,
        } : null,
        created_at: img.uploadedAt,
      };
    });

    // Return in the same order as requested
    const idOrder = new Map(ids.map((id, index) => [id, index]));
    formattedImages.sort((a, b) => {
      const orderA = idOrder.get(a.id) ?? 999;
      const orderB = idOrder.get(b.id) ?? 999;
      return orderA - orderB;
    });

    return apiResponse({
      images: formattedImages,
      found: formattedImages.length,
      requested: ids.length,
    });
  } catch (error) {
    console.error('API Error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
