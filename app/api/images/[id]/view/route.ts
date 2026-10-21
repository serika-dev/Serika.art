import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { NO_STORE_HEADERS } from '@/lib/cacheHeaders';

// Image pages are served from the ISR cache, so views are counted here by the
// client instead of during server render.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sequentialId = parseInt(id, 10);
  if (isNaN(sequentialId)) {
    return NextResponse.json({ success: false, error: 'Invalid image ID' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    await query(`UPDATE images SET views = views + 1 WHERE sequential_id = $1`, [sequentialId]);
    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Error counting view:', error);
    return NextResponse.json({ success: false }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
