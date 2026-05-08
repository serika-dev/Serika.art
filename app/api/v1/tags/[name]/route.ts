import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { publicImageMongoFilter } from '@/lib/contentFilters';

// GET /api/v1/tags/[name] - Get tag details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const validation = await validateApiKey(request, ['tags:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const { name } = await params;
    // Next.js automatically decodes URL parameters, so name is already decoded
    const tagName = name.toLowerCase().trim();

    const collection = await getCollection('tags');
    const imagesCollection = await getCollection('images');

    const tag = await collection.findOne({ name: tagName });

    if (!tag) {
      return apiError('Tag not found', 404, 'NOT_FOUND');
    }

    // Get sample images with this tag
    const sampleImages = await imagesCollection
      .find({ ...publicImageMongoFilter(), tags: tag._id, rating: 'safe' })
      .sort({ upvotes: -1 })
      .limit(5)
      .toArray();

    // Get actual count (in case cached count is wrong)
    const actualCount = await imagesCollection.countDocuments({
      ...publicImageMongoFilter(),
      tags: tag._id,
    });

    const formattedTag = {
      id: tag._id.toString(),
      name: tag.name,
      type: tag.type,
      count: actualCount,
      created_at: tag.createdAt,
      sample_images: sampleImages.map((img) => ({
        id: img._id.toString(),
        thumbnail_url: img.thumbnailUrl || img.url,
        rating: img.rating,
      })),
    };

    return apiResponse(formattedTag);
  } catch (error) {
    console.error('API v1 tag detail error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
