import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

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
      const tagsCollection = await getCollection('tags');
      const complementaryTags = await tagsCollection
        .find({ name: { $in: complementaryTagNames } })
        .limit(3)
        .toArray();

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

    // Fallback: Find commonly co-occurring tags
    const imagesCollection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    
    // First, find the tag ID for the input tag
    const targetTag = await tagsCollection.findOne({ name: normalizedTag });
    if (!targetTag) {
      return NextResponse.json({
        success: true,
        suggestions: [],
      });
    }

    const coOccurringImages = await imagesCollection
      .find({
        tags: targetTag._id,
      })
      .limit(50)
      .toArray();

    // Count tag co-occurrences
    const tagCounts: Record<string, number> = {};
    coOccurringImages.forEach(image => {
      if (Array.isArray(image.tags)) {
        image.tags.forEach((tagId: any) => {
          const idString = tagId.toString();
          if (idString !== targetTag._id.toString()) {
            tagCounts[idString] = (tagCounts[idString] || 0) + 1;
          }
        });
      }
    });

    // Get top 3 co-occurring tag IDs
    const topTagIds = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    if (topTagIds.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
      });
    }

    // Fetch tag details
    const { ObjectId } = await import('mongodb');
    const suggestions = await tagsCollection
      .find({ _id: { $in: topTagIds.map(id => new ObjectId(id)) } })
      .toArray();

    return NextResponse.json({
      success: true,
      suggestions: suggestions.map(t => ({
        name: t.name,
        type: t.type,
        count: t.count,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching complementary tags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch complementary tags' },
      { status: 500 }
    );
  }
}
