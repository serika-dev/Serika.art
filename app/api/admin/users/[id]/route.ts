import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

async function checkAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  const result = await query(`SELECT rank FROM users WHERE id = $1`, [user.id]);
  const rank = result.rows[0]?.rank;
  if (rank === 'admin' || rank === 'owner') return { ...user, rank };
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    const { rank } = await request.json();

    if (!['user', 'moderator', 'admin', 'owner'].includes(rank)) {
      return NextResponse.json({ success: false, error: 'Invalid rank' }, { status: 400 });
    }

    // Only owner can set admin/owner ranks
    if (['admin', 'owner'].includes(rank) && admin.rank !== 'owner') {
      return NextResponse.json({ success: false, error: 'Only owner can set this rank' }, { status: 403 });
    }

    await query(
      `UPDATE users SET rank = $1, updated_at = NOW() WHERE id = $2`,
      [rank, id]
    );

    return NextResponse.json({ success: true, message: 'User rank updated' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
