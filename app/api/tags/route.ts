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

    const normalizedQuery = query.trim().toLowerCase();
    
    // Escape special regex characters
    const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const collection = await getCollection('tags');
    
    // Fetch potential matches
    const allMatches = await collection
      .find({
        name: { $regex: escapedQuery, $options: 'i' },
      })
      .sort({ count: -1 })
      .limit(limit * 3) // Get more to filter
      .toArray();

    // Score and sort suggestions
    const scoredSuggestions = allMatches.map((tag: any) => {
      const tagName = tag.name.toLowerCase();
      let score = 0;
      
      // Exact match - highest priority
      if (tagName === normalizedQuery) {
        score = 1000000 + tag.count;
      }
      // Starts with query - high priority
      else if (tagName.startsWith(normalizedQuery)) {
        score = 100000 + tag.count;
      }
      // Word boundary match (e.g., "blue" matches "blue eyes" but not "blueberry")
      else if (tagName.startsWith(normalizedQuery + ' ') || tagName.includes(' ' + normalizedQuery + ' ') || tagName.endsWith(' ' + normalizedQuery)) {
        score = 10000 + tag.count;
      }
      // Contains query - lowest priority
      else {
        score = tag.count;
      }
      
      return { ...tag, score };
    });

    // Sort by score descending
    const suggestions = scoredSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...tag }) => tag); // Remove score from response

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
