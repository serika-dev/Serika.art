import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import {
  fetchDanbooruPost,
  fetchDanbooruPostsByArtist,
  mapDanbooruRating,
  extractDanbooruTags,
  DanbooruPost,
} from '@/lib/danbooru';
import { getCollection } from '@/lib/db';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2';
import sharp from 'sharp';
import { ObjectId } from 'mongodb';

const ACCOUNTS_API = process.env.ACCOUNTS_URL || 'https://accounts.serika.dev';
const ACCOUNTS_KEY = process.env.ACCOUNTS_INTERNAL_KEY || '';

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
): Promise<{ mainUrl: string; width: number; height: number }> {
  // Download the image
  const imageResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(imageResponse.data);

  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  // Generate unique filename with proper folder structure
  const timestamp = Date.now();
  const ext = fileUrl.split('.').pop()?.split('?')[0] || 'jpg';
  const mainKey = `uploads/${timestamp}-danbooru-${postId}.${ext}`;

  // Upload main image only
  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: mainKey,
      Body: imageBuffer,
      ContentType: `image/${ext}`,
    })
  );

  const r2Domain = process.env.R2_CUSTOM_DOMAIN;
  return {
    mainUrl: `https://${r2Domain}/${mainKey}`,
    width,
    height,
  };
}

async function importDanbooruPost(post: DanbooruPost) {
  try {
    const imagesCollection = await getCollection('images');
    const tagsCollection = await getCollection('tags');

    // Check if already imported
    const existing = await imagesCollection.findOne({ 'metadata.danbooruId': post.id });
    if (existing) {
      return { success: false, error: 'Post already imported', postId: post.id };
    }

    // Download and upload image
    const fileUrl = post.file_url || post.large_file_url;
    if (!fileUrl) {
      return { success: false, error: 'No file URL available', postId: post.id };
    }

    const { mainUrl, width, height } = await downloadAndUploadImage(
      fileUrl,
      post.id
    );

    // Extract and create tags, resolve to ObjectIDs
    const tagData = extractDanbooruTags(post);
    const tagIds: ObjectId[] = [];

    for (const tagInfo of tagData) {
      let tag = await tagsCollection.findOne({ name: tagInfo.name });
      if (!tag) {
        const result = await tagsCollection.insertOne({
          name: tagInfo.name,
          type: tagInfo.type,
          count: 0,
          createdAt: new Date(),
        });
        tagIds.push(result.insertedId);
      } else {
        tagIds.push(tag._id);
      }
    }

    // Create image document with full metadata
    const imageDoc = {
      userId: null, // Anonymous upload
      username: 'Anonymous',
      url: mainUrl,
      originalFilename: `danbooru-${post.id}.${post.file_ext}`,
      fileSize: post.file_size || 0,
      width,
      height,
      contentType: `image/${post.file_ext}`,
      tags: tagIds,
      rating: mapDanbooruRating(post.rating),
      isAIGenerated: false,
      source: post.source || `https://danbooru.donmai.us/posts/${post.id}`,
      description: '',
      upvotes: 0,
      downvotes: 0,
      favorites: 0,
      views: 0,
      metadata: {
        danbooruId: post.id,
        md5: post.md5,
        source: post.source || `https://danbooru.donmai.us/posts/${post.id}`,
        importedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await imagesCollection.insertOne(imageDoc);

    // Update tag counts
    for (const tagId of tagIds) {
      await tagsCollection.updateOne(
        { _id: tagId },
        { $inc: { count: 1 } }
      );
    }
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
    const { type, postId, artistTag, limit } = body;

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
    } else if (type === 'bulk') {
      // Bulk artist import with streaming progress
      if (!artistTag) {
        return NextResponse.json(
          { success: false, error: 'Artist tag is required' },
          { status: 400 }
        );
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

            // Send completion
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'complete',
                  total: posts.length,
                  successful: results.filter((r) => r && r.success).length,
                  results,
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
