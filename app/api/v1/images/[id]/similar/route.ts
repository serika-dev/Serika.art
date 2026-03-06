import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { ObjectId } from 'mongodb';

// GET /api/v1/similar/:id - Get similar images based on tags
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
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));

    // Validate ID format
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return apiError('Invalid image ID format', 400, 'INVALID_ID');
    }

    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');

    // Find the source image
    const sourceImage = await collection.findOne({ _id: objectId });
    if (!sourceImage) {
      return apiError('Image not found', 404, 'NOT_FOUND');
    }

    // Get similar images based on shared tags
    const similarImages = await collection
      .aggregate([
        {
          $match: {
            _id: { $ne: objectId },
            tags: { $in: sourceImage.tags || [] },
            rating: sourceImage.rating, // Same rating
          },
        },
        {
          $addFields: {
            sharedTags: {
              $size: {
                $setIntersection: ['$tags', sourceImage.tags || []],
              },
            },
          },
        },
        { $sort: { sharedTags: -1, upvotes: -1 } },
        { $limit: limit },
      ])
      .toArray();

    // Get all tag IDs
    const allTagIds = new Set<string>();
    similarImages.forEach((img) => {
      (img.tags || []).forEach((tagId: ObjectId) => allTagIds.add(tagId.toString()));
    });

    const tagDocs = await tagsCollection
      .find({ _id: { $in: Array.from(allTagIds).map((id) => new ObjectId(id)) } })
      .toArray();
    const tagMap = new Map(tagDocs.map((t) => [t._id.toString(), t]));

    const formattedImages = similarImages.map((img) => ({
      id: img._id.toString(),
      dbid: img._id.toString(),
      post_id: img.sequentialId,
      sequential_id: img.sequentialId,
      url: img.url,
      thumbnail_url: img.thumbnailUrl,
      width: img.width,
      height: img.height,
      rating: img.rating,
      is_ai_generated: img.isAIGenerated || false,
      shared_tags: img.sharedTags,
      tags: (img.tags || []).slice(0, 10).map((tagId: ObjectId) => {
        const tag = tagMap.get(tagId.toString());
        return tag ? { name: tag.name, type: tag.type } : null;
      }).filter(Boolean),
      stats: {
        upvotes: img.upvotes || 0,
        downvotes: img.downvotes || 0,
        favorites: img.favorites || 0,
        views: img.views || 0,
      },
    }));

    return apiResponse({
      source_id: id,
      similar: formattedImages,
      count: formattedImages.length,
    });
  } catch (error) {
    console.error('API Error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
