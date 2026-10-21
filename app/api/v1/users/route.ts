import { NextRequest, NextResponse } from 'next/server';
import { listDirectory, isDirectorySort } from '@/lib/userDirectory';
import { publicCacheHeaders } from '@/lib/cacheHeaders';

// GET /api/v1/users – public user directory.
// ?contributors=true limits it to people with at least one public upload.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 100);
    const sortParam = searchParams.get('sort');
    const sort = isDirectorySort(sortParam) ? sortParam : 'newest';

    const { users, pagination } = await listDirectory({
      page,
      limit,
      sort,
      q: searchParams.get('q') || '',
      contributorsOnly: searchParams.get('contributors') === 'true',
    });

    return NextResponse.json(
      {
        success: true,
        users: users.map((user) => ({
          _id: user.id,
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
          rank: user.rank,
          createdAt: user.createdAt,
          uploadCount: user.uploadCount,
        })),
        pagination,
      },
      { headers: publicCacheHeaders(60, { swr: 600 }) }
    );
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
