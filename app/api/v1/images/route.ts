import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { Document, Filter, ObjectId, Sort } from 'mongodb';
import { publicImageMongoFilter, ratingMongoFilter } from '@/lib/contentFilters';

type ImageDocument = Document & {
  _id: ObjectId;
  tags?: ObjectId[];
};

// GET /api/v1/images - List images with pagination and filters
export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const tagNames = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || [];
    const sort = searchParams.get('sort') || 'newest';
    const aiOnly = searchParams.get('ai') === 'true';
    const search = searchParams.get('q') || '';
    const userId = searchParams.get('user_id');
    const minWidth = parseInt(searchParams.get('min_width') || '0');
    const minHeight = parseInt(searchParams.get('min_height') || '0');

    const skip = (page - 1) * limit;

    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');

    // Build query
    const query: Filter<Document> & Record<string, unknown> = publicImageMongoFilter();

    if (userId) {
      if (ObjectId.isValid(userId)) {
        query.userId = new ObjectId(userId);
      }
    }

    // Resolve tag names to ObjectIDs
    if (tagNames.length > 0) {
      const tagDocs = await tagsCollection
        .find({ name: { $in: tagNames.map((t) => t.toLowerCase()) } })
        .toArray();
      const tagIds = tagDocs.map((t) => t._id);
      if (tagIds.length > 0) {
        query.tags = { $all: tagIds };
      } else {
        return apiResponse([], {
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }
    }

    const ratingFilter = ratingMongoFilter(ratings);
    if (ratingFilter) {
      query.rating = ratingFilter;
    }

    if (aiOnly) {
      query.isAIGenerated = true;
    }

    if (minWidth > 0) {
      query.width = { $gte: minWidth };
    }

    if (minHeight > 0) {
      query.height = { $gte: minHeight };
    }

    if (search) {
      const tagSearchResults = await tagsCollection
        .find({ name: { $regex: search, $options: 'i' } })
        .toArray();
      const tagIds = tagSearchResults.map((t) => t._id);

      query.$or = [
        { tags: { $in: tagIds } },
        { description: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    // Determine sort
    let sortOption: Sort = { createdAt: -1 };
    switch (sort) {
      case 'popular':
        sortOption = { upvotes: -1, views: -1 };
        break;
      case 'favorites':
        sortOption = { favorites: -1 };
        break;
      case 'views':
        sortOption = { views: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'random':
        // Use aggregation for random
        break;
    }

    let images: ImageDocument[];
    let total: number;

    if (sort === 'random') {
      const pipeline: Document[] = [{ $match: query }];
      pipeline.push({ $sample: { size: limit } });

      images = await collection.aggregate<ImageDocument>(pipeline).toArray();
      total = await collection.countDocuments(query);
    } else {
      [images, total] = await Promise.all([
        collection.find<ImageDocument>(query).sort(sortOption).skip(skip).limit(limit).toArray(),
        collection.countDocuments(query),
      ]);
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
      updated_at: img.updatedAt,
    }));

    return apiResponse(formattedImages, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        has_next: page < Math.ceil(total / limit),
        has_prev: page > 1,
      },
    });
  } catch (error) {
    console.error('API v1 images error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
