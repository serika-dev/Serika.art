import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type'); // filter by tag type

    const collection = await getCollection('tags');
    
    const filter: any = {
      name: { $regex: query, $options: 'i' },
    };

    if (type && ['general', 'artist', 'character', 'copyright', 'meta'].includes(type)) {
      filter.type = type;
    }
    
    const tags = await collection
      .find(filter)
      .sort({ count: -1 })
      .limit(limit)
      .toArray();

    // Group by type for better organization
    const grouped = tags.reduce((acc: any, tag: any) => {
      const tagType = tag.type || 'general';
      if (!acc[tagType]) acc[tagType] = [];
      acc[tagType].push(tag);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      tags,
      grouped,
    });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

// Endpoint for tag autocomplete
export async function POST(request: NextRequest) {
  try {
    const { query, limit = 10 } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({
        success: true,
        suggestions: [],
      });
    }

    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const collection = await getCollection('tags');
    
    const suggestions = await collection
      .find({
        name: { $regex: `^${escapedQuery}`, $options: 'i' },
      })
      .sort({ count: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error: any) {
    console.error('Error fetching tag suggestions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
