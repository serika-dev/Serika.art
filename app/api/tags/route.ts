import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (type && ['general', 'artist', 'character', 'copyright', 'meta'].includes(type)) {
      conditions.push(`type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM tags ${whereClause} ORDER BY count DESC LIMIT $${paramIndex}`,
      [...params, limit]
    );

    const tags = result.rows;

    // Group by type
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

// Tag autocomplete
export async function POST(request: NextRequest) {
  try {
    const { query: searchQuery, limit = 10 } = await request.json();

    if (!searchQuery || typeof searchQuery !== 'string') {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const result = await query(
      `SELECT * FROM tags WHERE name ILIKE $1 ORDER BY count DESC LIMIT $2`,
      [`%${normalizedQuery}%`, limit * 3]
    );

    // Score and sort suggestions
    const scoredSuggestions = result.rows.map((tag: any) => {
      const tagName = tag.name.toLowerCase();
      let score = 0;

      if (tagName === normalizedQuery) {
        score = 1000000 + tag.count;
      } else if (tagName.startsWith(normalizedQuery)) {
        score = 100000 + tag.count;
      } else if (
        tagName.startsWith(normalizedQuery + ' ') ||
        tagName.includes(' ' + normalizedQuery + ' ') ||
        tagName.endsWith(' ' + normalizedQuery)
      ) {
        score = 10000 + tag.count;
      } else {
        score = tag.count;
      }

      return { ...tag, score };
    });

    const suggestions = scoredSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...tag }) => tag);

    return NextResponse.json({ success: true, suggestions });
  } catch (error: any) {
    console.error('Error fetching tag suggestions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
