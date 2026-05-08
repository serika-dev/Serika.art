import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { Document, Filter, ObjectId } from 'mongodb';
import { publicImageMongoFilter, ratingMongoFilter } from '@/lib/contentFilters';

type SearchResults = {
  images?: unknown[];
  tags?: unknown[];
  users?: unknown[];
};

// GET /api/v1/search - Search across images, tags, and users
export async function GET(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all'; // all, images, tags, users
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || [];

    if (!query || query.length < 2) {
      return apiError('Query must be at least 2 characters', 400, 'INVALID_QUERY');
    }

    const results: SearchResults = {};

    const imagesCollection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    const usersCollection = await getCollection('users');

    // Search images
    if (type === 'all' || type === 'images') {
      // Find matching tags first
      const matchingTags = await tagsCollection
        .find({ name: { $regex: query, $options: 'i' } })
        .limit(100)
        .toArray();
      const tagIds = matchingTags.map((t) => t._id);

      const imageQuery: Filter<Document> & Record<string, unknown> = {
        ...publicImageMongoFilter(),
        $or: [
          { tags: { $in: tagIds } },
          { description: { $regex: query, $options: 'i' } },
          { username: { $regex: query, $options: 'i' } },
        ],
      };
      const ratingFilter = ratingMongoFilter(ratings);
      if (ratingFilter) {
        imageQuery.rating = ratingFilter;
      }

      const images = await imagesCollection
        .find(imageQuery)
        .sort({ upvotes: -1 })
        .limit(limit)
        .toArray();

      // Get all tag IDs from found images
      const allTagIds = new Set<string>();
      images.forEach((img) => {
        (img.tags || []).forEach((tagId: ObjectId) => allTagIds.add(tagId.toString()));
      });

      const tagDocs = await tagsCollection
        .find({ _id: { $in: Array.from(allTagIds).map((id) => new ObjectId(id)) } })
        .toArray();
      const tagMap = new Map(tagDocs.map((t) => [t._id.toString(), t]));

      results.images = images.map((img) => ({
        id: img._id.toString(),
        dbid: img._id.toString(),
        post_id: img.sequentialId,
        url: img.url,
        thumbnail_url: img.thumbnailUrl,
        width: img.width,
        height: img.height,
        rating: img.rating,
        tags: (img.tags || []).slice(0, 5).map((tagId: ObjectId) => {
          const tag = tagMap.get(tagId.toString());
          return tag?.name || 'unknown';
        }),
        stats: {
          upvotes: img.upvotes || 0,
          views: img.views || 0,
        },
      }));
    }

    // Search tags
    if (type === 'all' || type === 'tags') {
      const tags = await tagsCollection
        .find({ name: { $regex: query, $options: 'i' } })
        .sort({ count: -1 })
        .limit(limit)
        .toArray();

      results.tags = tags.map((tag) => ({
        id: tag._id.toString(),
        name: tag.name,
        type: tag.type,
        count: tag.count || 0,
      }));
    }

    // Search users
    if (type === 'all' || type === 'users') {
      const users = await usersCollection
        .find({ username: { $regex: query, $options: 'i' } })
        .limit(limit)
        .toArray();

      results.users = users.map((user) => ({
        id: user._id.toString(),
        username: user.username,
        avatar_url: user.avatarUrl || null,
        rank: user.rank,
      }));
    }

    return apiResponse(results, {
      query,
      type,
    });
  } catch (error) {
    console.error('API v1 search error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
