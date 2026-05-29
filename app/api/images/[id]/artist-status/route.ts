import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// Check if user can comment as artist on this image
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: true,
        canCommentAsArtist: false,
        artistTags: [],
      });
    }

    const { id } = await params;
    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const imgResult = await query(
      `SELECT id FROM images WHERE sequential_id = $1`,
      [sequentialId]
    );
    if (imgResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }
    const imageDbId = imgResult.rows[0].id;

    // Get user's verified artist pages that match image tags
    const matchResult = await query(
      `SELECT a.tag_id, a.tag_name
       FROM artists a
       JOIN image_tags it ON it.tag_id = a.tag_id
       WHERE a.claimed_by_user_id = $1
         AND a.verified = TRUE
         AND it.image_id = $2`,
      [user.id, imageDbId]
    );

    if (matchResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        canCommentAsArtist: false,
        artistTags: [],
      });
    }

    return NextResponse.json({
      success: true,
      canCommentAsArtist: true,
      artistTags: matchResult.rows.map(r => ({
        tagId: String(r.tag_id),
        tagName: r.tag_name,
      })),
    });
  } catch (error: any) {
    console.error('Error checking artist status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check artist status' },
      { status: 500 }
    );
  }
}
