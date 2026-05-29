import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';

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

    const result = await query(
      `SELECT * FROM images WHERE sequential_id = $1`,
      [sequentialId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    const image = result.rows[0];

    if (image.deleted || image.unlisted) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    // Fetch tags
    const tagsResult = await query(
      `SELECT t.id, t.name, t.type, t.count
       FROM image_tags it
       JOIN tags t ON t.id = it.tag_id
       WHERE it.image_id = $1`,
      [image.id]
    );

    const populatedTags = tagsResult.rows.map(t => ({
      _id: t.id,
      id: t.id,
      name: t.name,
      type: t.type,
      count: t.count,
    }));

    // Increment view count (fire-and-forget)
    query(
      `UPDATE images SET views = views + 1 WHERE sequential_id = $1`,
      [sequentialId]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      image: {
        ...image,
        dbid: String(image.id),
        _id: String(image.id),
        post_id: image.sequential_id,
        sequentialId: image.sequential_id,
        tags: populatedTags,
        views: image.views + 1,
        // Compatibility aliases
        thumbnailUrl: image.thumbnail_url,
        userId: image.user_id,
        fileSize: image.file_size,
        contentType: image.content_type,
        isAIGenerated: image.is_ai_generated,
        originalFilename: image.original_filename,
        createdAt: image.created_at,
        updatedAt: image.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, userRank, tags: newTags, description, source, rating, isAIGenerated } = body;

    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const imgResult = await query(
      `SELECT * FROM images WHERE sequential_id = $1`,
      [sequentialId]
    );

    if (imgResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    const image = imgResult.rows[0];

    // Check authorization
    const isPoster = image.user_id && userId && image.user_id === userId;
    const isModerator = userRank && ['moderator', 'admin', 'owner'].includes(userRank);

    if (!isPoster && !isModerator) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await withTransaction(async (client) => {
      // Handle tags update
      if (newTags && Array.isArray(newTags)) {
        // Get current tag IDs
        const currentTagsResult = await client.query(
          `SELECT tag_id FROM image_tags WHERE image_id = $1`,
          [image.id]
        );
        const oldTagIds = new Set(currentTagsResult.rows.map(r => r.tag_id));

        // Resolve new tag names to IDs (create if needed)
        const newTagIds: number[] = [];
        for (const tagInfo of newTags) {
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
          newTagIds.push(tagResult.rows[0].id);
        }

        // Delete old associations
        await client.query(`DELETE FROM image_tags WHERE image_id = $1`, [image.id]);

        // Insert new associations
        if (newTagIds.length > 0) {
          const values = newTagIds.map((tid, i) => `($1, $${i + 2})`).join(',');
          await client.query(
            `INSERT INTO image_tags (image_id, tag_id) VALUES ${values}`,
            [image.id, ...newTagIds]
          );
        }

        // Update tag counts
        const newTagIdSet = new Set(newTagIds);

        // Decrement removed tags
        for (const oldId of oldTagIds) {
          if (!newTagIdSet.has(oldId)) {
            await client.query(
              `UPDATE tags SET count = GREATEST(count - 1, 0) WHERE id = $1`,
              [oldId]
            );
          }
        }

        // Increment added tags
        for (const newId of newTagIds) {
          if (!oldTagIds.has(newId)) {
            await client.query(
              `UPDATE tags SET count = count + 1 WHERE id = $1`,
              [newId]
            );
          }
        }
      }

      // Build SET clauses for other fields
      const setClauses: string[] = ['updated_at = NOW()'];
      const updateParams: any[] = [];
      let pIdx = 1;

      if (description !== undefined) {
        setClauses.push(`description = $${pIdx}`);
        updateParams.push(description);
        pIdx++;
      }
      if (source !== undefined) {
        setClauses.push(`source = $${pIdx}`);
        updateParams.push(source);
        pIdx++;
      }
      if (rating !== undefined && ['safe', 'questionable', 'explicit'].includes(rating)) {
        setClauses.push(`rating = $${pIdx}`);
        updateParams.push(rating);
        pIdx++;
      }
      if (isAIGenerated !== undefined) {
        setClauses.push(`is_ai_generated = $${pIdx}`);
        updateParams.push(isAIGenerated);
        pIdx++;
      }

      if (updateParams.length > 0 || setClauses.length > 1) {
        await client.query(
          `UPDATE images SET ${setClauses.join(', ')} WHERE sequential_id = $${pIdx}`,
          [...updateParams, sequentialId]
        );
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Image updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update image' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await request.json();

    const sequentialId = parseInt(id, 10);
    if (isNaN(sequentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }

    const imgResult = await query(
      `SELECT * FROM images WHERE sequential_id = $1`,
      [sequentialId]
    );

    if (imgResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    const image = imgResult.rows[0];

    // Check ownership
    if (image.user_id && userId && image.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await withTransaction(async (client) => {
      // Get tag IDs before deleting
      const tagsResult = await client.query(
        `SELECT tag_id FROM image_tags WHERE image_id = $1`,
        [image.id]
      );

      // Delete the image (cascades to image_tags, votes, favorites, comments)
      await client.query(`DELETE FROM images WHERE id = $1`, [image.id]);

      // Decrement tag counts
      for (const row of tagsResult.rows) {
        await client.query(
          `UPDATE tags SET count = GREATEST(count - 1, 0) WHERE id = $1`,
          [row.tag_id]
        );
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
