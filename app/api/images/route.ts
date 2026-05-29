import { NextRequest, NextResponse } from 'next/server';
import { query, cacheGet, cacheSet } from '@/lib/db';
import { publicImageFilter, ratingFilter } from '@/lib/contentFilters';

// Cache tag lookups
const TAG_CACHE_TTL = 60; // 1 minute (Redis seconds)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 100);
    const tagNames = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || [];
    const sort = searchParams.get('sort') || 'newest';
    const aiOnly = searchParams.get('ai') === 'true';
    const hideAI = searchParams.get('hideAI') === 'true';
    const search = searchParams.get('q') || '';
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');

    const offset = (page - 1) * limit;

    // Build dynamic WHERE clauses
    const conditions: string[] = [publicImageFilter()];
    const params: any[] = [];
    let paramIndex = 1;

    if (username) {
      conditions.push(`LOWER(i.username) = LOWER($${paramIndex})`);
      params.push(username);
      paramIndex++;
    } else if (userId) {
      if (userId === 'null') {
        conditions.push(`i.user_id IS NULL`);
      } else {
        conditions.push(`i.user_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
      }
    }

    // Resolve tag names to IDs
    if (tagNames.length > 0) {
      const tagPlaceholders = tagNames.map((_, i) => `$${i + 1}`);
      const tagResult = await query(
        `SELECT id FROM tags WHERE name = ANY(ARRAY[${tagPlaceholders.join(',')}])`,
        tagNames.map(t => t.toLowerCase())
      );

      const tagIds = tagResult.rows.map(r => r.id);
      if (tagIds.length === 0) {
        return NextResponse.json({
          success: true,
          images: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }

      // Images must have ALL specified tags
      conditions.push(
        `i.id IN (
          SELECT image_id FROM image_tags
          WHERE tag_id = ANY($${paramIndex}::int[])
          GROUP BY image_id
          HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}
        )`
      );
      params.push(tagIds);
      paramIndex++;
    }

    // Rating filter
    const rf = ratingFilter(ratings, paramIndex);
    if (rf) {
      conditions.push(`i.${rf.clause}`);
      params.push(...rf.params);
      paramIndex += rf.params.length;
    }

    if (aiOnly) {
      conditions.push(`i.is_ai_generated = TRUE`);
    }

    if (hideAI) {
      conditions.push(`i.is_ai_generated = FALSE`);
    }

    if (search) {
      // Search in tag names, description, and username
      const searchParam = `%${search}%`;
      conditions.push(`(
        i.description ILIKE $${paramIndex}
        OR i.username ILIKE $${paramIndex}
        OR i.id IN (
          SELECT it.image_id FROM image_tags it
          JOIN tags t ON t.id = it.tag_id
          WHERE t.name ILIKE $${paramIndex}
        )
      )`);
      params.push(searchParam);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Determine ORDER BY
    let orderBy = 'i.created_at DESC';
    switch (sort) {
      case 'popular':    orderBy = 'i.upvotes DESC, i.views DESC'; break;
      case 'favorites':  orderBy = 'i.favorites DESC'; break;
      case 'views':      orderBy = 'i.views DESC'; break;
      case 'oldest':     orderBy = 'i.created_at ASC'; break;
      case 'filesize':   orderBy = 'i.file_size DESC'; break;
      case 'filesize-asc': orderBy = 'i.file_size ASC'; break;
      case 'resolution': orderBy = 'i.width DESC, i.height DESC'; break;
      case 'aspectratio': orderBy = 'i.width DESC'; break;
      case 'alphabetical': orderBy = 'i.username ASC, i.created_at DESC'; break;
      case 'alphabetical-reverse': orderBy = 'i.username DESC, i.created_at DESC'; break;
      case 'random':     orderBy = 'RANDOM()'; break;
    }

    // Execute queries in parallel
    // Use direct count query with alias since whereClause contains subqueries referencing 'i.'
    const countCacheKey = `count:images:${whereClause}:${JSON.stringify(params)}`;
    const [imagesResult, countResult] = await Promise.all([
      query(
        `SELECT i.id, i.sequential_id, i.user_id, i.username, i.url, i.thumbnail_url,
                i.width, i.height, i.file_size, i.rating, i.is_ai_generated,
                i.upvotes, i.downvotes, i.favorites, i.views, i.created_at
         FROM images i
         WHERE ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      (async () => {
        const cached = await cacheGet(countCacheKey);
        if (cached !== null) return parseInt(cached, 10);
        const res = await query(
          `SELECT COUNT(*) as count FROM images i WHERE ${whereClause}`,
          params
        );
        const count = parseInt(res.rows[0]?.count ?? '0', 10);
        await cacheSet(countCacheKey, String(count), 300);
        return count;
      })(),
    ]);

    const images = imagesResult.rows;

    // Batch-fetch tags for all images
    if (images.length > 0) {
      const imageIds = images.map(img => img.id);
      const tagsResult = await query(
        `SELECT it.image_id, t.id as tag_id, t.name, t.type, t.count
         FROM image_tags it
         JOIN tags t ON t.id = it.tag_id
         WHERE it.image_id = ANY($1::int[])`,
         [imageIds]
      );

      // Group tags by image_id
      const tagsByImage = new Map<number, any[]>();
      for (const row of tagsResult.rows) {
        const list = tagsByImage.get(row.image_id) || [];
        list.push({ _id: row.tag_id, id: row.tag_id, name: row.name, type: row.type, count: row.count });
        tagsByImage.set(row.image_id, list);
      }

      // Populate images with tags and compatibility fields
      for (const img of images) {
        (img as any).tags = tagsByImage.get(img.id) || [];
        (img as any).dbid = String(img.id);
        (img as any).post_id = img.sequential_id;
        (img as any)._id = String(img.id);
        
        // camelCase compatibility fields for React components
        (img as any).sequentialId = img.sequential_id;
        (img as any).userId = img.user_id;
        (img as any).thumbnailUrl = img.thumbnail_url;
        (img as any).isAIGenerated = img.is_ai_generated;
        (img as any).fileSize = img.file_size;
        (img as any).createdAt = img.created_at;
      }
    }

    const total = countResult;
    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      images,
      pagination: {
        page,
        limit,
        total,
        pages,
        has_next: page < pages,
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
