import { NextRequest, NextResponse } from 'next/server';
import { query, cacheGet, cacheSet } from '@/lib/db';
import { publicCacheHeaders } from '@/lib/cacheHeaders';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Autocomplete as a GET (?suggest=) so the CDN can answer repeat keystrokes
    const suggest = searchParams.get('suggest');
    if (suggest !== null) {
      const suggestions = await suggestTags(suggest, searchParams.get('limit'));
      return NextResponse.json({ success: true, suggestions }, { headers: publicCacheHeaders(300, { browserSeconds: 60 }) });
    }

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
    }, { headers: publicCacheHeaders(120) });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

// Tag autocomplete (POST kept for older clients; the site uses GET ?suggest=)
export async function POST(request: NextRequest) {
  try {
    const { query: searchQuery, limit = 10 } = await request.json();
    const suggestions = await suggestTags(searchQuery, limit);
    return NextResponse.json({ success: true, suggestions });
  } catch (error: any) {
    console.error('Error fetching tag suggestions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}

async function suggestTags(searchQuery: unknown, limit: unknown): Promise<any[]> {
  if (!searchQuery || typeof searchQuery !== 'string') return [];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const safeLimit = Math.min(Math.max(parseInt(String(limit)) || 10, 1), 50);

  // Autocomplete is hit on every keystroke — serve hot queries from cache.
  const cacheKey = `tagac:${normalizedQuery}:${safeLimit}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== null) return JSON.parse(cached);

  const result = await query(
    `SELECT id, name, type, count FROM tags WHERE name ILIKE $1 ORDER BY count DESC LIMIT $2`,
    [`%${normalizedQuery}%`, safeLimit * 3]
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
    .slice(0, safeLimit)
    .map(({ score, ...tag }) => tag);

  await cacheSet(cacheKey, JSON.stringify(suggestions), 120);
  return suggestions;
}
