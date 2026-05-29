import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';

// GET /api/v1/images/[id] - Get single image details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const { id } = await params;
    const imageId = parseInt(id, 10);
    if (isNaN(imageId)) {
      return apiError('Invalid image ID', 400, 'INVALID_ID');
    }

    const imageResult = await query(
      `SELECT i.*, u.username as u_username
       FROM images i
       LEFT JOIN users u ON u.id = i.user_id
       WHERE i.id = $1`,
      [imageId]
    );

    if (imageResult.rows.length === 0) {
      return apiError('Image not found', 404, 'NOT_FOUND');
    }

    const image = imageResult.rows[0];

    // Get tags
    const tagsResult = await query(
      `SELECT t.name, t.type
       FROM image_tags it
       JOIN tags t ON t.id = it.tag_id
       WHERE it.image_id = $1`,
      [imageId]
    );

    // Get comment count
    const commentCountResult = await query(
      `SELECT COUNT(*) as count FROM comments WHERE image_id = $1`,
      [imageId]
    );
    const commentCount = parseInt(commentCountResult.rows[0].count, 10);

    // Format response
    const formattedImage = {
      id: String(image.id),
      dbid: String(image.id),
      post_id: image.sequential_id,
      url: image.url,
      thumbnail_url: image.thumbnail_url,
      original_filename: image.original_filename,
      width: image.width,
      height: image.height,
      file_size: image.file_size,
      content_type: image.content_type,
      rating: image.rating,
      is_ai_generated: image.is_ai_generated,
      source: image.source || null,
      description: image.description || null,
      tags: tagsResult.rows.map(t => ({ name: t.name, type: t.type })),
      stats: {
        upvotes: image.upvotes || 0,
        downvotes: image.downvotes || 0,
        favorites: image.favorites || 0,
        views: image.views || 0,
        score: (image.upvotes || 0) - (image.downvotes || 0),
        comments: commentCount,
      },
      user: {
        id: image.user_id || null,
        username: image.u_username || image.username || 'Anonymous',
      },
      created_at: image.created_at,
      updated_at: image.updated_at,
    };

    // Increment view count (non-blocking)
    query(`UPDATE images SET views = views + 1 WHERE id = $1`, [imageId]).catch((err) =>
      console.error('Error incrementing view count:', err)
    );

    return apiResponse(formattedImage);
  } catch (error: any) {
    console.error('API v1 image detail error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

// DELETE /api/v1/images/[id] - Delete an image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const validation = await validateApiKey(request, ['images:delete']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const { id } = await params;
    const imageId = parseInt(id, 10);
    if (isNaN(imageId)) {
      return apiError('Invalid image ID', 400, 'INVALID_ID');
    }

    const imageResult = await query(`SELECT * FROM images WHERE id = $1`, [imageId]);

    if (imageResult.rows.length === 0) {
      return apiError('Image not found', 404, 'NOT_FOUND');
    }

    const image = imageResult.rows[0];

    // Check ownership (API key owner must match image owner or be admin)
    if (image.user_id && validation.apiKey!.user_id !== image.user_id) {
      // Check if user is admin
      const apiUserResult = await query(`SELECT rank FROM users WHERE id = $1`, [validation.apiKey!.user_id]);
      const apiUser = apiUserResult.rows[0];

      if (!apiUser || !['admin', 'owner'].includes(apiUser.rank)) {
        return apiError('Unauthorized to delete this image', 403, 'FORBIDDEN');
      }
    }

    // Perform deletions in a transaction
    await withTransaction(async (client) => {
      // Get associated tags
      const tagIdsResult = await client.query(
        `SELECT tag_id FROM image_tags WHERE image_id = $1`,
        [imageId]
      );
      const tagIds = tagIdsResult.rows.map(r => r.tag_id);

      // Decrement tag counts
      if (tagIds.length > 0) {
        await client.query(
          `UPDATE tags SET count = count - 1 WHERE id = ANY($1::int[])`,
          [tagIds]
        );
      }

      // Delete relationships and image
      await client.query(`DELETE FROM votes WHERE image_id = $1`, [imageId]);
      await client.query(`DELETE FROM favorites WHERE image_id = $1`, [imageId]);
      await client.query(`DELETE FROM comments WHERE image_id = $1`, [imageId]);
      await client.query(`DELETE FROM image_tags WHERE image_id = $1`, [imageId]);
      await client.query(`DELETE FROM images WHERE id = $1`, [imageId]);
    });

    return apiResponse({ deleted: true, id: String(imageId) });
  } catch (error: any) {
    console.error('API v1 image delete error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
