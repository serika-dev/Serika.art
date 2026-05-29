import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import {
  fetchDanbooruPost,
  fetchDanbooruPostsByArtist,
  fetchDanbooruPostsByTags,
  mapDanbooruRating,
  extractDanbooruTags,
  isAIPost,
  DanbooruPost,
} from '@/lib/danbooru';
import { query, getNextSequentialId, withTransaction } from '@/lib/db';
import { uploadToB2 } from '@/lib/b2';
import sharp from 'sharp';

interface ImportResult {
  success: boolean;
  error?: string;
  postId: number;
  imageId?: string;
  skipped?: boolean;
}

async function checkAdminAuth(request: NextRequest) {
  try {
    const { getCurrentUser } = await import('@/lib/auth');
    const user = await getCurrentUser();
    if (!user) return null;
    if (user.rank === 'admin' || user.rank === 'owner') return user;
    return null;
  } catch (err) {
    return null;
  }
}

async function downloadAndUploadImage(
  fileUrl: string,
  postId: number
): Promise<{ mainUrl: string; thumbnailUrl: string; width: number; height: number }> {
  // Download the image
  const imageResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  let imageBuffer = Buffer.from(imageResponse.data);

  // Get image metadata and convert if needed
  let metadata;
  try {
    metadata = await sharp(imageBuffer).metadata();
  } catch (error) {
    // If sharp can't read it, try to convert from webp or other format to jpeg
    try {
      imageBuffer = await sharp(imageBuffer).toFormat('jpeg', { quality: 90 }).toBuffer();
      metadata = await sharp(imageBuffer).metadata();
    } catch (convertError) {
      throw new Error('Unsupported image format and conversion failed');
    }
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;

  // Generate unique filename with proper folder structure
  const timestamp = Date.now();
  let ext = fileUrl.split('.').pop()?.split('?')[0] || 'jpg';
  // Force jpg if we had to convert
  if (ext === 'webp' || ext === 'gif') {
    ext = 'jpg';
  }
  const mainFilename = `${timestamp}-danbooru-${postId}.${ext}`;
  const thumbFilename = `thumb-${timestamp}-danbooru-${postId}.jpg`;

  // Upload main image
  const mainUrl = await uploadToB2(imageBuffer, mainFilename, `image/${ext}`);

  // Create and upload thumbnail (aggressive compression for previews)
  const thumbnailBuffer = await sharp(imageBuffer)
    .resize(320, 320, { fit: 'cover' })
    .jpeg({ quality: 45, mozjpeg: true, progressive: true })
    .toBuffer();
  const thumbnailUrl = await uploadToB2(
    thumbnailBuffer,
    thumbFilename,
    'image/jpeg',
    'thumbnails'
  );

  return {
    mainUrl,
    thumbnailUrl,
    width,
    height,
  };
}

async function importDanbooruPost(post: DanbooruPost): Promise<ImportResult> {
  try {
    // Check if already imported
    const existing = await query(
      `SELECT id FROM images WHERE metadata->>'danbooruId' = $1`,
      [String(post.id)]
    );
    if (existing.rows.length > 0) {
      return { success: false, error: 'Post already imported', postId: post.id, skipped: true };
    }

    // Download and upload image
    const fileUrl = post.file_url || post.large_file_url;
    if (!fileUrl) {
      return { success: false, error: 'No file URL available (post may be deleted or restricted)', postId: post.id, skipped: true };
    }

    const { mainUrl, thumbnailUrl, width, height } = await downloadAndUploadImage(
      fileUrl,
      post.id
    );

    // Extract tags
    const tagData = extractDanbooruTags(post);

    // Run insertion inside transaction
    const finalImageId = await withTransaction(async (client) => {
      const tagIds: number[] = [];

      for (const tagInfo of tagData) {
        let tagRes = await client.query(`SELECT id FROM tags WHERE name = $1`, [tagInfo.name]);
        if (tagRes.rows.length === 0) {
          tagRes = await client.query(
            `INSERT INTO tags (name, type, count, created_at) VALUES ($1, $2, 0, NOW()) RETURNING id`,
            [tagInfo.name, tagInfo.type]
          );
        }
        tagIds.push(tagRes.rows[0].id);
      }

      // Get sequential ID
      // Note: getNextSequentialId queries the counters table, let's execute inside transaction
      const nextSeqResult = await client.query(
        `INSERT INTO counters (name, value)
         VALUES ('imageSequentialId', 1)
         ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
         RETURNING value`
      );
      const nextSequentialId = nextSeqResult.rows[0].value;

      // Check if this is an AI-generated post
      const isAIGenerated = isAIPost(post);

      const metadataJson = {
        danbooruId: post.id,
        md5: post.md5,
        source: post.source || `https://danbooru.donmai.us/posts/${post.id}`,
        importedAt: new Date().toISOString(),
      };

      // Insert image
      const imageInsertResult = await client.query(
        `INSERT INTO images (
          sequential_id, user_id, username, url, thumbnail_url,
          original_filename, file_size, width, height, content_type,
          rating, is_ai_generated, source, description,
          upvotes, downvotes, favorites, views, metadata,
          created_at, updated_at
        ) VALUES ($1, null, 'Anonymous', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '', 0, 0, 0, 0, $12, NOW(), NOW())
        RETURNING id`,
        [
          nextSequentialId,
          mainUrl,
          thumbnailUrl,
          `danbooru-${post.id}.${post.file_ext}`,
          post.file_size || 0,
          width,
          height,
          `image/${post.file_ext}`,
          mapDanbooruRating(post.rating),
          isAIGenerated,
          post.source || `https://danbooru.donmai.us/posts/${post.id}`,
          JSON.stringify(metadataJson),
        ]
      );

      const newImageId = imageInsertResult.rows[0].id;

      // Insert image_tags relationships
      if (tagIds.length > 0) {
        const values = tagIds.map((_, idx) => `($1, $${idx + 2})`).join(', ');
        await client.query(
          `INSERT INTO image_tags (image_id, tag_id) VALUES ${values}`,
          [newImageId, ...tagIds]
        );

        // Increment tag counts
        await client.query(
          `UPDATE tags SET count = count + 1 WHERE id = ANY($1::int[])`,
          [tagIds]
        );
      }

      return newImageId;
    });

    return { success: true, imageId: String(finalImageId), postId: post.id };
  } catch (error: any) {
    console.error('Error importing Danbooru post:', error);
    return { success: false, error: error.message, postId: post.id };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const user = await checkAdminAuth(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { type, postId, artistTag, tags, limit, background } = body;

    if (type === 'single') {
      // Single post import
      if (!postId) {
        return NextResponse.json(
          { success: false, error: 'Post ID is required' },
          { status: 400 }
        );
      }

      const post = await fetchDanbooruPost(postId);
      if (!post) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch Danbooru post' },
          { status: 404 }
        );
      }

      const result = await importDanbooruPost(post);
      return NextResponse.json(result);
    } else if (type === 'artist') {
      // Bulk artist import
      if (!artistTag) {
        return NextResponse.json(
          { success: false, error: 'Artist tag is required' },
          { status: 400 }
        );
      }

      // If background mode, start the import asynchronously
      if (background) {
        console.log(`[BACKGROUND IMPORT] Starting artist import for "${artistTag}" with limit ${limit || 100}`);
        
        // Start import in background (don't await)
        const importPromise = (async () => {
          try {
            console.log(`[BACKGROUND IMPORT] Fetching posts for artist "${artistTag}"...`);
            const posts = await fetchDanbooruPostsByArtist(artistTag, limit || 100);
            console.log(`[BACKGROUND IMPORT] Found ${posts.length} posts for artist "${artistTag}"`);
            
            for (let i = 0; i < posts.length; i++) {
              const post = posts[i];
              console.log(`[BACKGROUND IMPORT] [${i + 1}/${posts.length}] Processing post ${post.id}...`);
              const result = await importDanbooruPost(post);
              
              if (result.success) {
                console.log(`[BACKGROUND IMPORT] [${i + 1}/${posts.length}] ✓ Imported post ${post.id}`);
              } else if (result.skipped) {
                console.log(`[BACKGROUND IMPORT] [${i + 1}/${posts.length}] ⊘ Skipped post ${post.id}:`, result.error);
              } else {
                console.error(`[BACKGROUND IMPORT] [${i + 1}/${posts.length}] ✗ Failed to import post ${post.id}:`, result.error);
              }
              
              // Add delay between imports
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
            
            console.log(`[BACKGROUND IMPORT] Complete: ${artistTag}`);
          } catch (error: any) {
            console.error(`[BACKGROUND IMPORT] Fatal error for ${artistTag}:`, error);
          }
        })();
        
        // Keep the promise alive
        importPromise.catch(err => console.error('[BACKGROUND IMPORT] Unhandled error:', err));

        return NextResponse.json({
          success: true,
          message: `Import started in background for "${artistTag}" (${limit || 100} posts)`,
        });
      }

      const posts = await fetchDanbooruPostsByArtist(artistTag, limit || 100);
      if (posts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No posts found for this artist' },
          { status: 404 }
        );
      }

      // Use streaming response for real-time progress updates
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send initial progress
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', total: posts.length })}\n\n`));

            const results = [];
            for (let i = 0; i < posts.length; i++) {
              const post = posts[i];
              const result = await importDanbooruPost(post);
              results.push(result);

              // Send progress update after each import
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    current: i + 1,
                    total: posts.length,
                    result,
                  })}\n\n`
                )
              );

              // Add delay between imports
              await new Promise((resolve) => setTimeout(resolve, 300));
            }

            // Send completion with only defined results
            const validResults = results.filter((r) => r !== undefined && r !== null);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'complete',
                  total: posts.length,
                  successful: validResults.filter((r) => r.success).length,
                  results: validResults,
                })}\n\n`
              )
            );

            controller.close();
          } catch (error: any) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  error: error.message,
                })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else if (type === 'tags') {
      // Bulk tag search import
      if (!tags) {
        return NextResponse.json(
          { success: false, error: 'Search tags are required' },
          { status: 400 }
        );
      }

      // If background mode, start the import asynchronously
      if (background) {
        console.log(`[BACKGROUND IMPORT] Starting tag import for "${tags}" with limit ${limit || 100}`);
        
        // Start import in background (don't await)
        const importPromise = (async () => {
          try {
            console.log(`[BACKGROUND IMPORT] Fetching posts for tags "${tags}"...`);
            const posts = await fetchDanbooruPostsByTags(tags, limit || 100);
            console.log(`[BACKGROUND IMPORT] Found ${posts.length} posts for tags "${tags}"`);
            
            for (let i = 0; i < posts.length; i++) {
              const post = posts[i];
              console.log(`[BACKGROUND IMPORT] [${i + 1}/${posts.length}] Processing post ${post.id}...`);
              const result = await importDanbooruPost(post);
              
              if (result.success) {
                console.log(`[BACKGROUND IMPORT] [${i + 1}/${posts.length}] ✓ Imported post ${post.id}`);
              } else if (result.skipped) {
                console.log(`[BACKGROUND IMPORT] [${i + 1}/${posts.length}] ⊘ Skipped post ${post.id}:`, result.error);
              } else {
                console.error(`[BACKGROUND IMPORT] [${i + 1}/${posts.length}] ✗ Failed to import post ${post.id}:`, result.error);
              }
              
              // Add delay between imports
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
            
            console.log(`[BACKGROUND IMPORT] Complete: ${tags}`);
          } catch (error: any) {
            console.error(`[BACKGROUND IMPORT] Fatal error for ${tags}:`, error);
          }
        })();
        
        // Keep the promise alive
        importPromise.catch(err => console.error('[BACKGROUND IMPORT] Unhandled error:', err));

        return NextResponse.json({
          success: true,
          message: `Import started in background for "${tags}" (${limit || 100} posts)`,
        });
      }

      const posts = await fetchDanbooruPostsByTags(tags, limit || 100);
      if (posts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No posts found for these tags' },
          { status: 404 }
        );
      }

      // Use streaming response for real-time progress updates
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send initial progress
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', total: posts.length })}\n\n`));

            const results = [];
            for (let i = 0; i < posts.length; i++) {
              const post = posts[i];
              const result = await importDanbooruPost(post);
              results.push(result);

              // Send progress update after each import
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    current: i + 1,
                    total: posts.length,
                    result,
                  })}\n\n`
                )
              );

              // Add delay between imports
              await new Promise((resolve) => setTimeout(resolve, 300));
            }

            // Send completion with only defined results
            const validResults = results.filter((r) => r !== undefined && r !== null);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'complete',
                  total: posts.length,
                  successful: validResults.filter((r) => r.success).length,
                  results: validResults,
                })}\n\n`
              )
            );

            controller.close();
          } catch (error: any) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  error: error.message,
                })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid import type' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
