import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '24', 10);
    const offset = (page - 1) * limit;

    // Count total favorites
    const countResult = await query(
      `SELECT COUNT(*) as count FROM favorites WHERE user_id = $1`,
      [user.id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get favorited images with tags
    const favResult = await query(
      `SELECT i.*, f.created_at as favorited_at
       FROM favorites f
       JOIN images i ON i.id = f.image_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    const images = favResult.rows;

    // Batch-fetch tags
    if (images.length > 0) {
      const imageIds = images.map(img => img.id);
      const tagsResult = await query(
        `SELECT it.image_id, t.id as tag_id, t.name, t.type, t.count
         FROM image_tags it
         JOIN tags t ON t.id = it.tag_id
         WHERE it.image_id = ANY($1::int[])`,
        [imageIds]
      );

      const tagsByImage = new Map<number, any[]>();
      for (const row of tagsResult.rows) {
        const list = tagsByImage.get(row.image_id) || [];
        list.push({ _id: row.tag_id, id: row.tag_id, name: row.name, type: row.type, count: row.count });
        tagsByImage.set(row.image_id, list);
      }

      for (const img of images) {
        (img as any).tags = tagsByImage.get(img.id) || [];
        (img as any).dbid = String(img.id);
        (img as any)._id = String(img.id);
        (img as any).post_id = img.sequential_id;
        (img as any).sequentialId = img.sequential_id;
        (img as any).thumbnailUrl = img.thumbnail_url;
      }
    }

    return NextResponse.json({
      success: true,
      images,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { imageId } = await request.json();

    const sequentialId = parseInt(imageId, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    // Get image
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

    // Check if already favorited
    const existing = await query(
      `SELECT id FROM favorites WHERE user_id = $1 AND image_id = $2`,
      [user.id, imageDbId]
    );

    let isFavorited = false;

    if (existing.rows.length > 0) {
      // Remove favorite
      await query(`DELETE FROM favorites WHERE id = $1`, [existing.rows[0].id]);
      await query(
        `UPDATE images SET favorites = GREATEST(favorites - 1, 0) WHERE id = $1`,
        [imageDbId]
      );
      isFavorited = false;
    } else {
      // Add favorite
      await query(
        `INSERT INTO favorites (user_id, image_id, created_at) VALUES ($1, $2, NOW())`,
        [user.id, imageDbId]
      );
      await query(
        `UPDATE images SET favorites = favorites + 1 WHERE id = $1`,
        [imageDbId]
      );
      isFavorited = true;
    }

    const updated = await query(
      `SELECT favorites FROM images WHERE id = $1`,
      [imageDbId]
    );

    return NextResponse.json({
      success: true,
      isFavorited,
      favorites: updated.rows[0]?.favorites || 0,
    });
  } catch (error: any) {
    console.error('Error toggling favorite:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to favorite images' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}
