import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// Get a tag by name
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const normalized = name.toLowerCase().trim();
    const possibleNames = Array.from(new Set([
      normalized,
      normalized.replace(/ /g, '_'),
      normalized.replace(/_/g, ' '),
    ]));

    const result = await query(
      `SELECT * FROM tags WHERE name = ANY($1)`,
      [possibleNames]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tag not found' },
        { status: 404 }
      );
    }

    const tag = result.rows[0];
    return NextResponse.json({
      success: true,
      tag: {
        _id: String(tag.id),
        id: tag.id,
        name: tag.name,
        type: tag.type,
        count: tag.count,
        createdAt: tag.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching tag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tag' },
      { status: 500 }
    );
  }
}

// Update tag type (admin+ only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userResult = await query(
      `SELECT rank FROM users WHERE id = $1`,
      [user.id]
    );
    const rank = userResult.rows[0]?.rank || 'user';

    if (rank !== 'admin' && rank !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Admin+ required.' },
        { status: 403 }
      );
    }

    const { name } = await params;
    const { type } = await request.json();

    if (!['general', 'artist', 'character', 'copyright', 'meta'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tag type' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE tags SET type = $1 WHERE name = $2 RETURNING id`,
      [type, name.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Tag not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tag type updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update tag' },
      { status: 500 }
    );
  }
}
