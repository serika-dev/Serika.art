import { NextRequest } from 'next/server';
import { query as dbQuery } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';

// GET /api/v1/tags - List all tags
export async function GET(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['tags:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100')));
    const search = searchParams.get('q') || '';
    const type = searchParams.get('type');
    const sort = searchParams.get('sort') || 'count';
    const minCount = parseInt(searchParams.get('min_count') || '0');

    const skip = (page - 1) * limit;

    // Build query
    const whereClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(`name ILIKE $${paramIndex}`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (type && ['general', 'artist', 'character', 'copyright', 'meta'].includes(type)) {
      whereClauses.push(`type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (minCount > 0) {
      whereClauses.push(`count >= $${paramIndex}`);
      queryParams.push(minCount);
      paramIndex++;
    }

    // Determine sort
    let sortClause = 'count DESC';
    if (sort === 'name') {
      sortClause = 'name ASC';
    } else if (sort === 'newest') {
      sortClause = 'created_at DESC';
    } else if (sort === 'oldest') {
      sortClause = 'created_at ASC';
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await dbQuery(
      `SELECT COUNT(*) as count FROM tags ${whereString}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const tagsResult = await dbQuery(
      `SELECT * FROM tags ${whereString} ORDER BY ${sortClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, skip]
    );

    const formattedTags = tagsResult.rows.map((tag) => ({
      id: String(tag.id),
      name: tag.name,
      type: tag.type,
      count: tag.count || 0,
      created_at: tag.created_at,
    }));

    return apiResponse(formattedTags, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        has_next: page < Math.ceil(total / limit),
        has_prev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('API v1 tags error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
