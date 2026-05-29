import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Define common tag relationships
const TAG_RELATIONSHIPS: Record<string, string[]> = {
  // Copyright -> Character mappings
  'arknights': ['doctor (arknights)', 'amiya (arknights)', 'texas (arknights)', 'exusiai (arknights)'],
  'genshin impact': ['raiden shogun', 'zhongli', 'nahida', 'furina'],
  'honkai: star rail': ['kafka', 'stelle', 'march 7th', 'dan heng'],
  'blue archive': ['hoshino (blue archive)', 'shiroko (blue archive)', 'aru (blue archive)'],
  'azur lane': ['enterprise (azur lane)', 'belfast (azur lane)', 'prinz eugen (azur lane)'],
  
  // Character -> Copyright mappings (reverse)
  'raiden shogun': ['genshin impact'],
  'zhongli': ['genshin impact'],
  'kafka': ['honkai: star rail'],
  'hoshino (blue archive)': ['blue archive'],
  'shiroko (blue archive)': ['blue archive'],
  
  // Common tag combinations
  '1girl': ['solo', 'looking at viewer'],
  '1boy': ['solo', 'male focus'],
  'multiple girls': ['2girls', '3girls'],
  'school uniform': ['serafuku', 'blazer'],
  'long hair': ['very long hair', 'twintails', 'ponytail'],
  'short hair': ['bob cut', 'pixie cut'],
  'blue eyes': ['looking at viewer'],
  'red eyes': ['looking at viewer'],
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tag } = body;

    if (!tag) {
      return NextResponse.json(
        { success: false, error: 'Tag is required' },
        { status: 400 }
      );
    }

    const normalizedTag = tag.toLowerCase().trim();
    const complementaryTagNames = TAG_RELATIONSHIPS[normalizedTag] || [];

    // If we have predefined relationships, fetch those tags from DB
    if (complementaryTagNames.length > 0) {
      const complementaryTagsResult = await query(
        `SELECT * FROM tags WHERE name = ANY($1)`,
        [complementaryTagNames]
      );
      const complementaryTags = complementaryTagsResult.rows;

      // Return existing tags, or create placeholder entries
      const suggestions = complementaryTagNames.slice(0, 3).map(tagName => {
        const existingTag = complementaryTags.find(t => t.name === tagName);
        if (existingTag) {
          return {
            name: existingTag.name,
            type: existingTag.type,
            count: existingTag.count,
          };
        }
        return {
          name: tagName,
          type: 'general',
          count: 0,
        };
      });

      return NextResponse.json({
        success: true,
        suggestions,
      });
    }

    // Fallback: Find commonly co-occurring tags via SQL join
    // First, find the tag ID for the input tag
    const targetTagResult = await query(`SELECT id FROM tags WHERE name = $1`, [normalizedTag]);
    if (targetTagResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
      });
    }
    const targetTagId = targetTagResult.rows[0].id;

    // Fetch top 3 co-occurring tags
    const coOccurringResult = await query(
      `SELECT t.name, t.type, t.count, COUNT(it2.image_id) as co_occurrence
       FROM image_tags it1
       JOIN image_tags it2 ON it2.image_id = it1.image_id
       JOIN tags t ON t.id = it2.tag_id
       WHERE it1.tag_id = $1 AND it2.tag_id != $1
       GROUP BY t.id, t.name, t.type, t.count
       ORDER BY co_occurrence DESC, t.count DESC
       LIMIT 3`,
      [targetTagId]
    );

    const suggestions = coOccurringResult.rows.map(t => ({
      name: t.name,
      type: t.type,
      count: t.count,
    }));

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error: any) {
    console.error('Error fetching complementary tags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch complementary tags' },
      { status: 500 }
    );
  }
}
