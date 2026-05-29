import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sequentialId = parseInt(id, 10);
    
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: true,
        vote: null,
        isFavorited: false,
      });
    }

    // Get internal PostgreSQL image ID
    const imgResult = await query(
      `SELECT id FROM images WHERE sequential_id = $1`,
      [sequentialId]
    );

    if (imgResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        vote: null,
        isFavorited: false,
      });
    }

    const imageDbId = imgResult.rows[0].id;

    // Fetch user vote and favorite status in parallel
    const [voteRes, favRes] = await Promise.all([
      query(
        `SELECT type FROM votes WHERE user_id = $1 AND image_id = $2`,
        [user.id, imageDbId]
      ),
      query(
        `SELECT 1 FROM favorites WHERE user_id = $1 AND image_id = $2`,
        [user.id, imageDbId]
      ),
    ]);

    return NextResponse.json({
      success: true,
      vote: voteRes.rows[0]?.type || null,
      isFavorited: favRes.rows.length > 0,
    });
  } catch (error: any) {
    console.error('Error in user-interaction endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
