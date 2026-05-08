import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { Document, Filter, ObjectId, Sort } from 'mongodb';
import { publicImageMongoFilter, ratingMongoFilter } from '@/lib/contentFilters';

type ImageDocument = Document & {
  _id: ObjectId;
  sequentialId?: number;
  tags?: ObjectId[];
};

// Cache tag lookups to reduce DB queries
const tagNameCache = new Map<string, ObjectId>();
const tagIdCache = new Map<string, { name: string; type: string; count: number }>();
const TAG_CACHE_TTL = 60000; // 1 minute
let lastTagCacheClear = Date.now();

function clearTagCacheIfNeeded() {
  if (Date.now() - lastTagCacheClear > TAG_CACHE_TTL) {
    tagNameCache.clear();
    tagIdCache.clear();
    lastTagCacheClear = Date.now();
  }
}

export async function GET(request: NextRequest) {
  try {
    clearTagCacheIfNeeded();
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 100); // Cap at 100
    const tagNames = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || [];
    const sort = searchParams.get('sort') || 'newest';
    const aiOnly = searchParams.get('ai') === 'true';
    const hideAI = searchParams.get('hideAI') === 'true';
    const search = searchParams.get('q') || '';
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');

    const skip = (page - 1) * limit;

    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    
    // Build query
    const query: Filter<Document> & Record<string, unknown> = publicImageMongoFilter();
    
    if (username) {
      // Filter by username
      query.username = { $regex: new RegExp(`^${username}$`, 'i') };
    } else if (userId) {
      if (userId === 'null') {
        // Anonymous images
        query.userId = null;
      } else {
        query.userId = new ObjectId(userId);
      }
    }
    
    // Resolve tag names to ObjectIDs
    if (tagNames.length > 0) {
      const tagDocs = await tagsCollection
        .find({ name: { $in: tagNames.map(t => t.toLowerCase()) } })
        .toArray();
      const tagIds = tagDocs.map(t => t._id);
      if (tagIds.length > 0) {
        query.tags = { $all: tagIds };
      } else {
        // No matching tags, return empty result
        return NextResponse.json({
          success: true,
          images: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
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
    
    if (hideAI) {
      query.isAIGenerated = { $ne: true };
    }
    
    if (search) {
      // Search in tag names, description, and username
      const tagSearchResults = await tagsCollection
        .find({ name: { $regex: search, $options: 'i' } })
        .toArray();
      const tagIds = tagSearchResults.map(t => t._id);
      
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
      case 'filesize':
        sortOption = { fileSize: -1 };
        break;
      case 'filesize-asc':
        sortOption = { fileSize: 1 };
        break;
      case 'resolution':
        // Sort by total pixels (width * height)
        sortOption = { width: -1, height: -1 };
        break;
      case 'aspectratio':
        // Sort by aspect ratio (wider first)
        sortOption = { width: -1 };
        break;
      case 'alphabetical':
        sortOption = { username: 1, createdAt: -1 };
        break;
      case 'alphabetical-reverse':
        sortOption = { username: -1, createdAt: -1 };
        break;
      case 'random':
        // Random sort is handled differently (sample aggregation)
        // Note: Random sampling does not support traditional pagination - each page request
        // will return a different random sample. This is by design for discovery features.
        sortOption = { _id: 1 }; // placeholder, handled below
        break;
    }

    // Use projection to only fetch needed fields (faster for large collections)
    const projection = {
      sequentialId: 1,
      userId: 1,
      username: 1,
      url: 1,
      thumbnailUrl: 1,
      width: 1,
      height: 1,
      fileSize: 1,
      tags: 1,
      rating: 1,
      isAIGenerated: 1,
      upvotes: 1,
      downvotes: 1,
      favorites: 1,
      views: 1,
      createdAt: 1,
    };

    let images: ImageDocument[];
    let hasNext = false;
    
    // Avoid blocking UI filter changes on expensive exact counts over huge result sets.
    if (sort === 'random') {
      const pipeline = [
        { $match: query },
        { $sample: { size: limit } },
        { $project: projection },
      ];
      
      images = await collection.aggregate<ImageDocument>(pipeline).toArray();
      hasNext = images.length === limit;
    } else {
      const rows = await collection
        .find<ImageDocument>(query, { projection })
        .sort(sortOption)
        .skip(skip)
        .limit(limit + 1)
        .toArray();
      hasNext = rows.length > limit;
      images = rows.slice(0, limit);
    }

    // Populate tags for all images (batch lookup)
    const allTagIds = new Set<string>();
    images.forEach((img) => {
      if (Array.isArray(img.tags)) {
        img.tags.forEach((tagId) => {
          const idStr = tagId.toString();
          if (!tagIdCache.has(idStr)) {
            allTagIds.add(idStr);
          }
        });
      }
    });

    // Only fetch uncached tags
    if (allTagIds.size > 0) {
      const tagDocs = await tagsCollection
        .find(
          { _id: { $in: Array.from(allTagIds).map(id => new ObjectId(id)) } },
          { projection: { name: 1, type: 1, count: 1 } }
        )
        .toArray();
      
      tagDocs.forEach(t => {
        tagIdCache.set(t._id.toString(), { name: t.name, type: t.type, count: t.count || 0 });
      });
    }

    // Map images with cached tag data
    const populatedImages = images.map((img) => ({
      ...img,
      dbid: img._id.toString(),
      post_id: img.sequentialId,
      tags: (img.tags || []).map((tagId) => {
        const idStr = tagId.toString();
        const tag = tagIdCache.get(idStr);
        return {
          _id: tagId,
          name: tag?.name || 'unknown',
          type: tag?.type || 'general',
          count: tag?.count || 0,
        };
      }),
    }));

    const approximateTotal = skip + populatedImages.length + (hasNext ? limit : 0);
    const pages = Math.max(page, Math.ceil(approximateTotal / limit));

    return NextResponse.json({
      success: true,
      images: populatedImages,
      pagination: {
        page,
        limit,
        total: approximateTotal,
        pages,
        has_next: hasNext,
        exact_total: false,
      },
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}
