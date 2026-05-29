import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { uploadToB2 } from '@/lib/b2';
import { uploadLocally } from '@/lib/localStorage';
import { requireAuth } from '@/lib/auth';
import sharp from 'sharp';

const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';

export async function POST(request: NextRequest) {
  try {
    // Try to get user, but allow anonymous uploads
    let user: any = null;
    try {
      const { getCurrentUser } = await import('@/lib/auth');
      user = await getCurrentUser();
    } catch {
      // Anonymous upload
    }

    // If user exists, ensure they're in local DB
    if (user) {
      let rank: 'user' | 'moderator' | 'admin' | 'owner' = 'user';
      if (user.id === '692ad0df032c62f79b57a08d') {
        rank = 'owner';
      }

      await query(
        `INSERT INTO users (id, username, email, avatar_url, rank, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           username = $2, email = $3, avatar_url = $4, rank = CASE WHEN users.rank IN ('moderator','admin','owner') THEN users.rank ELSE $5 END, updated_at = NOW()`,
        [user.id, user.username, user.email, user.avatarUrl || '', rank]
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tagsString = formData.get('tags') as string;
    let tagsData = [];
    try {
      tagsData = JSON.parse(tagsString);
    } catch {
      tagsData = tagsString?.split(',').map(t => ({ name: t.trim(), type: 'general' })).filter(t => t.name) || [];
    }
    const rating = formData.get('rating') as 'safe' | 'questionable' | 'explicit';
    const isAIGenerated = formData.get('isAIGenerated') === 'true';
    const postAnonymously = formData.get('postAnonymously') === 'true';
    const source = formData.get('source') as string || '';
    const description = formData.get('description') as string || '';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (tagsData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one tag is required' },
        { status: 400 }
      );
    }

    if (!['safe', 'questionable', 'explicit'].includes(rating)) {
      return NextResponse.json(
        { success: false, error: 'Invalid rating' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get image metadata
    const metadata = await sharp(buffer).metadata();

    // Create compressed thumbnail
    const thumbnailBuffer = await sharp(buffer)
      .resize(320, 320, { fit: 'cover' })
      .jpeg({ quality: 45, mozjpeg: true, progressive: true })
      .toBuffer();

    // Upload to storage
    let imageUrl: string;
    let thumbnailUrl: string;

    try {
      if (USE_LOCAL_STORAGE) {
        [imageUrl, thumbnailUrl] = await Promise.all([
          uploadLocally(buffer, file.name, file.type),
          uploadLocally(thumbnailBuffer, `thumb-${file.name}`, 'image/jpeg', 'thumbnails'),
        ]);
      } else {
        [imageUrl, thumbnailUrl] = await Promise.all([
          uploadToB2(buffer, file.name, file.type),
          uploadToB2(thumbnailBuffer, `thumb-${file.name}`, 'image/jpeg', 'thumbnails'),
        ]);
      }
    } catch (uploadError: any) {
      console.error('Primary upload failed, trying fallback:', uploadError);
      if (!USE_LOCAL_STORAGE) {
        try {
          [imageUrl, thumbnailUrl] = await Promise.all([
            uploadLocally(buffer, file.name, file.type),
            uploadLocally(thumbnailBuffer, `thumb-${file.name}`, 'image/jpeg', 'thumbnails'),
          ]);
        } catch (fallbackError) {
          throw new Error('Both B2 and local storage uploads failed.');
        }
      } else {
        throw uploadError;
      }
    }

    // Insert image and tags in a transaction (sequential ID is allocated atomically inside)
    const imageResult = await withTransaction(async (client) => {
      // Get the next sequential ID INSIDE the transaction to prevent races
      const seqResult = await client.query(
        `INSERT INTO counters (name, value)
         VALUES ('imageSequentialId', 1)
         ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
         RETURNING value`
      );
      const nextSequentialId = seqResult.rows[0].value;

      // Resolve tags
      const tagIds: number[] = [];
      for (const tagInfo of tagsData) {
        const tagName = tagInfo.name.toLowerCase();
        let tagResult = await client.query(
          `SELECT id FROM tags WHERE name = $1`,
          [tagName]
        );

        if (tagResult.rows.length === 0) {
          tagResult = await client.query(
            `INSERT INTO tags (name, type, count, created_at) VALUES ($1, $2, 0, NOW()) RETURNING id`,
            [tagName, tagInfo.type || 'general']
          );
        }
        tagIds.push(tagResult.rows[0].id);
      }

      // Insert image
      const imgResult = await client.query(
        `INSERT INTO images (
          sequential_id, user_id, username, url, thumbnail_url,
          original_filename, file_size, width, height, content_type,
          rating, is_ai_generated, source, description,
          upvotes, downvotes, favorites, views, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 0, 0, 0, NOW(), NOW())
        RETURNING *`,
        [
          nextSequentialId,
          (user && !postAnonymously) ? user.id : null,
          (user && !postAnonymously) ? user.username : 'Anonymous',
          imageUrl, thumbnailUrl,
          file.name, buffer.length,
          metadata.width || 0, metadata.height || 0,
          file.type, rating, isAIGenerated, source, description,
        ]
      );

      const imageId = imgResult.rows[0].id;

      // Insert image_tags
      if (tagIds.length > 0) {
        const values = tagIds.map((_, i) => `($1, $${i + 2})`).join(',');
        await client.query(
          `INSERT INTO image_tags (image_id, tag_id) VALUES ${values}`,
          [imageId, ...tagIds]
        );
      }

      // Increment tag counts
      for (const tagId of tagIds) {
        await client.query(
          `UPDATE tags SET count = count + 1 WHERE id = $1`,
          [tagId]
        );
      }

      return { ...imgResult.rows[0], _nextSequentialId: nextSequentialId };
    });

    const { _nextSequentialId, ...imageData } = imageResult;
    return NextResponse.json({
      success: true,
      image: {
        ...imageData,
        _id: String(imageData.id),
        dbid: String(imageData.id),
        post_id: _nextSequentialId,
        sequentialId: _nextSequentialId,
      },
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to upload images' },
        { status: 401 }
      );
    }

    let errorMessage = 'Failed to upload image';
    if (error.message?.includes('B2') || error.message?.includes('SSL') || error.code === 'EPROTO') {
      errorMessage = 'Failed to upload to storage. Please check your B2 configuration or try again later.';
    } else if (error.message?.includes('connection')) {
      errorMessage = 'Database connection error. Please try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
