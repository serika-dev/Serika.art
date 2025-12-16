import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { Image } from '@/lib/models';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const tagNames = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || [];
    const sort = searchParams.get('sort') || 'newest';
    const aiOnly = searchParams.get('ai') === 'true';
    const search = searchParams.get('q') || '';
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');

    const skip = (page - 1) * limit;

    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    
    // Build query
    const query: any = {};
    
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
    
    if (ratings.length > 0 && ratings.length < 3) {
      query.rating = { $in: ratings };
    }
    
    if (aiOnly) {
      query.isAIGenerated = true;
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
    let sortOption: any = { createdAt: -1 };
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
    }

    const [images, total] = await Promise.all([
      collection.find(query).sort(sortOption).skip(skip).limit(limit).toArray(),
      collection.countDocuments(query),
    ]);

    // Populate tags for all images
    const allTagIds = new Set<string>();
    images.forEach(img => {
      if (Array.isArray(img.tags)) {
        img.tags.forEach(tagId => allTagIds.add(tagId.toString()));
      }
    });

    let tagMap = new Map();
    if (allTagIds.size > 0) {
      const tagDocs = await tagsCollection
        .find({ _id: { $in: Array.from(allTagIds).map(id => new ObjectId(id)) } })
        .toArray();
      tagMap = new Map(tagDocs.map(t => [t._id.toString(), t]));
    }

    // Map images to replace tag IDs with populated tag data (including count)
    const populatedImages = images.map((img: any) => ({
      ...img,
      tags: (img.tags || []).map((tagId: any) => {
        const tag = tagMap.get(tagId.toString());
        return {
          _id: tagId,
          name: tag?.name || 'unknown',
          type: tag?.type || 'general',
          count: tag?.count || 0,
        };
      }),
    }));

    return NextResponse.json({
      success: true,
      images: populatedImages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}
