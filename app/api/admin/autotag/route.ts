import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getBackfillStatus } from '@/lib/autotagWorker';
import { isAutotaggerConfigured } from '@/lib/autotagger';
import { NO_STORE_HEADERS } from '@/lib/cacheHeaders';

// GET /api/admin/autotag – progress of the autotag backfill (admin+)
export async function GET() {
  const user = await getCurrentUser();
  const rank = user ? (await query(`SELECT rank FROM users WHERE id = $1`, [user.id])).rows[0]?.rank : null;
  if (rank !== 'admin' && rank !== 'owner') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403, headers: NO_STORE_HEADERS });
  }
  try {
    const status = await getBackfillStatus();
    return NextResponse.json({ success: true, configured: isAutotaggerConfigured(), ...status }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Admin autotag status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to read status' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
