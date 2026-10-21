import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { cachedCount } from '@/lib/imageSearch';
import { NO_STORE_HEADERS } from '@/lib/cacheHeaders';

const TYPES = ['general', 'artist', 'character', 'copyright', 'meta'];
const SORTS: Record<string, string> = {
  count: 'count DESC, name ASC',
  'count-asc': 'count ASC, name ASC',
  name: 'name ASC',
  'name-desc': 'name DESC',
  newest: 'created_at DESC, id DESC',
};

async function checkAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  const result = await query(`SELECT rank FROM users WHERE id = $1`, [user.id]);
  const rank = result.rows[0]?.rank;
  return rank === 'admin' || rank === 'owner' ? user : null;
}

// GET /api/admin/tags?page=&limit=&q=&type=&sort= – every tag, paginated (admin+)
export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '50', 10) || 50, 10), 200);
    const q = (sp.get('q') || '').trim().toLowerCase();
    const type = sp.get('type') || '';
    const sort = SORTS[sp.get('sort') || 'count'] ? sp.get('sort') || 'count' : 'count';

    const conditions: string[] = [];
    const params: any[] = [];
    if (q) {
      params.push(`%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }
    if (TYPES.includes(type)) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, count] = await Promise.all([
      query(
        `SELECT id, name, type, count, created_at FROM tags ${where}
         ORDER BY ${SORTS[sort]}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, (page - 1) * limit]
      ),
      cachedCount(`count:admintags:${where}:${JSON.stringify(params)}`, `SELECT COUNT(*) AS count FROM tags ${where}`, params, { ttl: 120 }),
    ]);

    const total = count.total;
    return NextResponse.json(
      {
        success: true,
        tags: rows.rows.map((t) => ({ _id: String(t.id), id: t.id, name: t.name, type: t.type, count: t.count, createdAt: t.created_at })),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('Admin tags error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tags' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
