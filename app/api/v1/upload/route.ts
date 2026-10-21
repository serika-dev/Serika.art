import { NextRequest } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { uploadToB2 } from '@/lib/b2';
import { uploadLocally } from '@/lib/localStorage';
import sharp from 'sharp';
import { autotagImage, AutotaggerUnavailableError } from '@/lib/autotagger';
import { revalidateImagePage } from '@/lib/revalidate';

const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';

// POST /api/v1/upload - Upload an image via API
export async function POST(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['upload']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tagsString = formData.get('tags') as string;
    let rating = formData.get('rating') as 'safe' | 'questionable' | 'explicit';
    const autoTag = formData.get('auto_tag') === 'true';
    const isAIGenerated = formData.get('is_ai_generated') === 'true' || formData.get('isAIGenerated') === 'true';
    const source = formData.get('source') as string || '';
    const description = formData.get('description') as string || '';

    // Validate file
    if (!file) {
      return apiError('No file provided', 400, 'MISSING_FILE');
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return apiError(
        `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
        400,
        'INVALID_FILE_TYPE'
      );
    }

    // Check file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return apiError('File too large. Maximum size is 50MB', 400, 'FILE_TOO_LARGE');
    }

    // Parse tags
    let tagsData: { name: string; type: string }[] = [];
    try {
      if (tagsString) {
        const parsed = JSON.parse(tagsString);
        if (Array.isArray(parsed)) {
          tagsData = parsed.map((t: any) => ({
            name: typeof t === 'string' ? t : t.name,
            type: typeof t === 'string' ? 'general' : t.type || 'general',
          }));
        }
      }
    } catch {
      // Fallback to comma-separated format
      if (tagsString) {
        tagsData = tagsString.split(',').map((t) => ({
          name: t.trim().toLowerCase(),
          type: 'general',
        })).filter((t) => t.name);
      }
    }

    if (tagsData.length === 0 && !autoTag) {
      return apiError('At least one tag is required (or pass auto_tag=true)', 400, 'MISSING_TAGS');
    }

    if (tagsData.length > 100) {
      return apiError('Maximum 100 tags allowed', 400, 'TOO_MANY_TAGS');
    }

    // Validate rating (auto_tag uploads may leave it to the tagger)
    if (!['safe', 'questionable', 'explicit'].includes(rating) && !(autoTag && !rating)) {
      return apiError(
        'Invalid rating. Must be: safe, questionable, or explicit',
        400,
        'INVALID_RATING'
      );
    }

    // Process image
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // auto_tag: merge the tagger's recommended tags (and rating, if none given)
    if (autoTag) {
      try {
        const suggestion = await autotagImage(buffer);
        // Same normalization as the tag insert below, so "long hair" + "long_hair" can't collide
        const norm = (name: string) => name.toLowerCase().replace(/\s+/g, '_');
        const have = new Set(tagsData.map((t) => norm(t.name)));
        for (const t of suggestion.tags) {
          if (t.recommended && !have.has(norm(t.name)) && tagsData.length < 100) {
            tagsData.push({ name: t.name, type: t.type });
            have.add(norm(t.name));
          }
        }
        if (!rating) rating = suggestion.rating?.value ?? 'safe';
      } catch (err) {
        if (!(err instanceof AutotaggerUnavailableError)) throw err;
        if (tagsData.length === 0 || !rating) {
          return apiError('Autotagger is unavailable; provide tags and rating manually', 503, 'AUTOTAGGER_UNAVAILABLE');
        }
      }
      if (tagsData.length === 0) {
        return apiError('No tags could be predicted for this image; provide them manually', 400, 'MISSING_TAGS');
      }
    }

    // Get metadata
    const sharpMetadata = await sharp(buffer).metadata();

    // Create thumbnail
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
      console.error('Upload error:', uploadError);
      return apiError('Failed to upload file', 500, 'UPLOAD_FAILED');
    }

    // Run db queries in a transaction
    const uploadResult = await withTransaction(async (client) => {
      // Resolve tag ObjectIDs to integer IDs
      const tagIds: number[] = [];
      for (const tagInfo of tagsData) {
        const normalizedName = tagInfo.name.toLowerCase().replace(/\s+/g, '_');
        let tagRes = await client.query(`SELECT id FROM tags WHERE name = $1`, [normalizedName]);
        
        if (tagRes.rows.length === 0) {
          const validTypes = ['general', 'artist', 'character', 'copyright', 'meta'];
          const tagType = validTypes.includes(tagInfo.type) ? tagInfo.type : 'general';

          tagRes = await client.query(
            `INSERT INTO tags (name, type, count, created_at) VALUES ($1, $2, 0, NOW()) RETURNING id`,
            [normalizedName, tagType]
          );
        }
        if (!tagIds.includes(tagRes.rows[0].id)) tagIds.push(tagRes.rows[0].id);
      }

      // Get next sequential ID from counters
      const seqResult = await client.query(
        `INSERT INTO counters (name, value)
         VALUES ('imageSequentialId', 1)
         ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
         RETURNING value`
      );
      const nextSequentialId = seqResult.rows[0].value;

      // Insert image
      const imageRes = await client.query(
        `INSERT INTO images (
          sequential_id, user_id, username, url, thumbnail_url,
          original_filename, file_size, width, height, content_type,
          rating, is_ai_generated, source, description,
          upvotes, downvotes, favorites, views, deleted, unlisted,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 0, 0, 0, FALSE, FALSE, NOW(), NOW())
        RETURNING id`,
        [
          nextSequentialId,
          validation.apiKey!.user_id,
          validation.apiKey!.username,
          imageUrl,
          thumbnailUrl,
          file.name,
          file.size,
          sharpMetadata.width || 0,
          sharpMetadata.height || 0,
          file.type,
          rating,
          isAIGenerated,
          source,
          description,
        ]
      );

      const newImageId = imageRes.rows[0].id;

      // Insert image_tags relations
      if (tagIds.length > 0) {
        const values = tagIds.map((_, idx) => `($1, $${idx + 2})`).join(', ');
        await client.query(
          `INSERT INTO image_tags (image_id, tag_id) VALUES ${values}`,
          [newImageId, ...tagIds]
        );

        // Update tag counts
        await client.query(
          `UPDATE tags SET count = count + 1 WHERE id = ANY($1::int[])`,
          [tagIds]
        );
      }

      return { imageId: newImageId, nextSequentialId, tagIds };
    });

    // A visit to this id before it existed may have cached a 404
    revalidateImagePage(uploadResult.nextSequentialId);

    // Get tag details for response
    const tagDocsRes = await query(`SELECT name, type FROM tags WHERE id = ANY($1::int[])`, [uploadResult.tagIds]);

    return apiResponse({
      id: String(uploadResult.imageId),
      dbid: String(uploadResult.imageId),
      post_id: uploadResult.nextSequentialId,
      url: imageUrl,
      thumbnail_url: thumbnailUrl,
      width: sharpMetadata.width || 0,
      height: sharpMetadata.height || 0,
      file_size: file.size,
      content_type: file.type,
      rating,
      is_ai_generated: isAIGenerated,
      tags: tagDocsRes.rows.map((t) => ({ name: t.name, type: t.type })),
      created_at: new Date(),
    }, {
      message: 'Image uploaded successfully',
    });
  } catch (error: any) {
    console.error('API v1 upload error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
