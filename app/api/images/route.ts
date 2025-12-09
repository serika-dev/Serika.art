import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { Image } from '@/lib/models';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || [];
    const sort = searchParams.get('sort') || 'newest';
    const aiOnly = searchParams.get('ai') === 'true';
    const search = searchParams.get('q') || '';
    const userId = searchParams.get('userId');

    const skip = (page - 1) * limit;

    const collection = await getCollection('images');
    
    // Build query
    const query: any = {};
    
    if (userId) {
      if (userId === 'null') {
        // Anonymous images
        query.userId = null;
      } else {
        query.userId = new ObjectId(userId);
      }
    }
    
    if (tags.length > 0) {
      query['tags.name'] = { $all: tags };
    }
    
    if (ratings.length > 0 && ratings.length < 3) {
      query.rating = { $in: ratings };
    }
    
    if (aiOnly) {
      query.isAIGenerated = true;
    }
    
    if (search) {
      query.$or = [
        { tags: { $regex: search, $options: 'i' } },
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

    return NextResponse.json({
      success: true,
      images,
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
