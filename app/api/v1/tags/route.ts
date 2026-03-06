import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { ObjectId } from 'mongodb';

// GET /api/v1/tags - List all tags
export async function GET(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['tags:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100')));
    const search = searchParams.get('q') || '';
    const type = searchParams.get('type');
    const sort = searchParams.get('sort') || 'count';
    const minCount = parseInt(searchParams.get('min_count') || '0');

    const skip = (page - 1) * limit;

    const collection = await getCollection('tags');

    // Build query
    const query: any = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (type && ['general', 'artist', 'character', 'copyright', 'meta'].includes(type)) {
      query.type = type;
    }

    if (minCount > 0) {
      query.count = { $gte: minCount };
    }

    // Determine sort
    let sortOption: any = { count: -1 };
    switch (sort) {
      case 'name':
        sortOption = { name: 1 };
        break;
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
    }

    const [tags, total] = await Promise.all([
      collection.find(query).sort(sortOption).skip(skip).limit(limit).toArray(),
      collection.countDocuments(query),
    ]);

    const formattedTags = tags.map((tag) => ({
      id: tag._id.toString(),
      name: tag.name,
      type: tag.type,
      count: tag.count || 0,
      created_at: tag.createdAt,
    }));

    return apiResponse(formattedTags, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        has_next: page < Math.ceil(total / limit),
        has_prev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('API v1 tags error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
