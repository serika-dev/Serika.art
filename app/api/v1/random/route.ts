import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { ObjectId } from 'mongodb';

// GET /api/v1/random - Get random image(s) with metadata
export async function GET(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['random:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const searchParams = request.nextUrl.searchParams;
    const count = Math.min(50, Math.max(1, parseInt(searchParams.get('count') || '1')));
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || [];
    const tagNames = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const excludeTags = searchParams.get('exclude_tags')?.split(',').filter(Boolean) || [];
    const minWidth = parseInt(searchParams.get('min_width') || '0');
    const minHeight = parseInt(searchParams.get('min_height') || '0');
    const maxWidth = parseInt(searchParams.get('max_width') || '0');
    const maxHeight = parseInt(searchParams.get('max_height') || '0');
    const aiOnly = searchParams.get('ai') === 'true';
    const noAi = searchParams.get('no_ai') === 'true';

    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');

    // Build query
    const query: any = {};

    // Rating filter
    if (ratings.length > 0) {
      const validRatings = ratings.filter((r) =>
        ['safe', 'questionable', 'explicit'].includes(r)
      );
      if (validRatings.length > 0) {
        query.rating = { $in: validRatings };
      }
    }

    // Tag filters
    if (tagNames.length > 0) {
      const tagDocs = await tagsCollection
        .find({ name: { $in: tagNames.map((t) => t.toLowerCase()) } })
        .toArray();
      const tagIds = tagDocs.map((t) => t._id);
      if (tagIds.length > 0) {
        query.tags = { $all: tagIds };
      } else {
        return apiResponse([], { message: 'No images match the specified tags' });
      }
    }

    // Exclude tags
    if (excludeTags.length > 0) {
      const excludeTagDocs = await tagsCollection
        .find({ name: { $in: excludeTags.map((t) => t.toLowerCase()) } })
        .toArray();
      const excludeTagIds = excludeTagDocs.map((t) => t._id);
      if (excludeTagIds.length > 0) {
        query.tags = { ...query.tags, $nin: excludeTagIds };
      }
    }

    // Dimension filters
    if (minWidth > 0) query.width = { ...query.width, $gte: minWidth };
    if (minHeight > 0) query.height = { ...query.height, $gte: minHeight };
    if (maxWidth > 0) query.width = { ...query.width, $lte: maxWidth };
    if (maxHeight > 0) query.height = { ...query.height, $lte: maxHeight };

    // AI filter
    if (aiOnly) query.isAIGenerated = true;
    if (noAi) query.isAIGenerated = { $ne: true };

    // Get random images using aggregation
    const pipeline: any[] = [
      { $match: query },
      { $sample: { size: count } },
    ];

    const images = await collection.aggregate(pipeline).toArray();

    if (images.length === 0) {
      return apiResponse([], { message: 'No images match the criteria' });
    }

    // Populate tags
    const allTagIds = new Set<string>();
    images.forEach((img) => {
      (img.tags || []).forEach((tagId: ObjectId) => allTagIds.add(tagId.toString()));
    });

    const tagDocs = await tagsCollection
      .find({ _id: { $in: Array.from(allTagIds).map((id) => new ObjectId(id)) } })
      .toArray();
    const tagMap = new Map(tagDocs.map((t) => [t._id.toString(), t]));

    // Format response
    const formattedImages = images.map((img) => ({
      id: img._id.toString(),
      dbid: img._id.toString(),
      post_id: img.sequentialId,
      url: img.url,
      thumbnail_url: img.thumbnailUrl,
      width: img.width,
      height: img.height,
      file_size: img.fileSize,
      content_type: img.contentType,
      rating: img.rating,
      is_ai_generated: img.isAIGenerated,
      source: img.source || null,
      description: img.description || null,
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
      user: {
        id: img.userId?.toString() || null,
        username: img.username || 'Anonymous',
      },
      created_at: img.createdAt,
    }));

    // Return single image if count is 1, otherwise array
    const data = count === 1 ? formattedImages[0] : formattedImages;

    return apiResponse(data, {
      count: formattedImages.length,
      requested: count,
    });
  } catch (error: any) {
    console.error('API v1 random error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
