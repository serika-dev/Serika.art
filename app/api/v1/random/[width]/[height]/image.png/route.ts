import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { publicImageMongoFilter, ratingMongoFilter } from '@/lib/contentFilters';
import { Document, Filter, ObjectId } from 'mongodb';
import sharp from 'sharp';

const RANDOM_IMAGE_CACHE_CONTROL = 'public, max-age=60, s-maxage=120, stale-while-revalidate=300';

type ImageDocument = Document & {
  _id: ObjectId;
  url: string;
  sequentialId?: number;
  width?: number;
  height?: number;
  rating?: string;
};

// GET /api/v1/random/[width]/[height]/image.png - Get random image resized to specified dimensions
// This endpoint returns the actual image file, not JSON
// No API key required for this endpoint - it's a public image service
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ width: string; height: string }> }
) {
  try {
    const { width: widthStr, height: heightStr } = await params;
    
    // Parse and validate dimensions
    const width = parseInt(widthStr);
    const height = parseInt(heightStr);
    
    if (isNaN(width) || isNaN(height)) {
      return new NextResponse('Invalid dimensions', { status: 400 });
    }
    
    // Support up to 8K resolution
    const maxDim = 8000;
    const minDim = 16;
    
    if (width < minDim || height < minDim || width > maxDim || height > maxDim) {
      return new NextResponse(
        `Dimensions must be between ${minDim} and ${maxDim}`,
        { status: 400 }
      );
    }
    
    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const ratings = searchParams.get('ratings')?.split(',').filter(Boolean) || ['safe'];
    const tagNames = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const excludeTags = searchParams.get('exclude_tags')?.split(',').filter(Boolean) || [];
    const fit = searchParams.get('fit') || 'cover'; // cover, contain, fill, inside, outside
    const format = searchParams.get('format') || 'png'; // png, jpeg, webp
    const quality = Math.min(100, Math.max(1, parseInt(searchParams.get('quality') || '85')));
    const blur = searchParams.get('blur') === 'true';
    const grayscale = searchParams.get('grayscale') === 'true';
    const aiOnly = searchParams.get('ai') === 'true';
    const noAI = searchParams.get('no_ai') === 'true';
    const matchSize = searchParams.get('match_size') === 'true'; // Default: fastest random sample
    const aspectTolerance = parseFloat(searchParams.get('aspect_tolerance') || '0.2'); // 20% tolerance
    
    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    
    // Build query
    const query: Filter<Document> & Record<string, unknown> = publicImageMongoFilter();
    
    // Default to safe-only unless specified
    const ratingFilter = ratingMongoFilter(ratings);
    if (ratingFilter) {
      query.rating = ratingFilter;
    }
    
    // AI filter
    if (aiOnly) {
      query.isAIGenerated = true;
    } else if (noAI) {
      query.isAIGenerated = { $ne: true };
    }
    
    // Tag filter
    if (tagNames.length > 0) {
      const tagDocs = await tagsCollection
        .find({ name: { $in: tagNames.map((t) => t.toLowerCase()) } })
        .toArray();
      const tagIds = tagDocs.map((t) => t._id);
      if (tagIds.length > 0) {
        query.tags = { $all: tagIds };
      }
    }
    
    // Exclude tags
    if (excludeTags.length > 0) {
      const excludeTagDocs = await tagsCollection
        .find({ name: { $in: excludeTags.map((t) => t.toLowerCase()) } })
        .toArray();
      const excludeTagIds = excludeTagDocs.map((t) => t._id);
      if (excludeTagIds.length > 0) {
        const existingTagFilter = typeof query.tags === 'object' && query.tags ? query.tags : {};
        query.tags = { ...existingTagFilter, $nin: excludeTagIds };
      }
    }
    
    // Calculate requested aspect ratio
    const requestedAspect = width / height;
    
    // Try to find images that match the requested dimensions/aspect ratio
    let images: ImageDocument[] = [];
    
    if (matchSize) {
      // First, try to find images that match or exceed the requested dimensions
      const sizeQuery = {
        ...query,
        width: { $gte: Math.min(width, 400) }, // At least 400px or requested width
        height: { $gte: Math.min(height, 400) }, // At least 400px or requested height
      };
      
      // Get candidates that are close to the requested aspect ratio
      const candidates = await collection
        .aggregate<ImageDocument>([
          { $match: sizeQuery },
          {
            $addFields: {
              aspectRatio: { $divide: ['$width', '$height'] },
              aspectDiff: {
                $abs: {
                  $subtract: [
                    { $divide: ['$width', '$height'] },
                    requestedAspect
                  ]
                }
              }
            }
          },
          {
            $match: {
              aspectDiff: { $lte: aspectTolerance }
            }
          },
          { $sample: { size: 1 } }
        ])
        .toArray();
      
      if (candidates.length > 0) {
        images = candidates;
      }
    }
    
    // If no matching size found, fall back to random
    if (images.length === 0) {
      images = await collection
        .aggregate<ImageDocument>([
          { $match: query },
          { $sample: { size: 1 } },
        ])
        .toArray();
    }
    
    if (images.length === 0) {
      // Return a placeholder image
      const placeholder = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 128, g: 128, b: 128, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      
      return new NextResponse(new Uint8Array(placeholder), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': RANDOM_IMAGE_CACHE_CONTROL,
        },
      });
    }
    
    const image = images[0];
    
    // Fetch the original image
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch source image');
    }
    
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    
    // Process image with sharp
    let sharpInstance = sharp(imageBuffer);
    
    // Resize with specified fit mode
    const validFits = ['cover', 'contain', 'fill', 'inside', 'outside'];
    const fitMode = validFits.includes(fit) ? fit as keyof sharp.FitEnum : 'cover';
    
    sharpInstance = sharpInstance.resize(width, height, {
      fit: fitMode,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    
    // Apply effects
    if (blur) {
      sharpInstance = sharpInstance.blur(10);
    }
    
    if (grayscale) {
      sharpInstance = sharpInstance.grayscale();
    }
    
    // Output format
    let outputBuffer: Buffer;
    let contentType: string;
    
    switch (format) {
      case 'jpeg':
      case 'jpg':
        outputBuffer = await sharpInstance.jpeg({ quality }).toBuffer();
        contentType = 'image/jpeg';
        break;
      case 'webp':
        outputBuffer = await sharpInstance.webp({ quality }).toBuffer();
        contentType = 'image/webp';
        break;
      default:
        outputBuffer = await sharpInstance.png({ quality: Math.min(quality, 100) }).toBuffer();
        contentType = 'image/png';
    }
    
    // Increment view count (non-blocking)
    collection.updateOne(
      { _id: image._id },
      { $inc: { views: 1 } }
    );
    
    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': RANDOM_IMAGE_CACHE_CONTROL,
        'X-Image-Id': image._id.toString(),
        'X-DBID': image._id.toString(),
        'X-Post-Id': String(image.sequentialId),
        'X-Original-Width': String(image.width),
        'X-Original-Height': String(image.height),
        'X-Rating': image.rating || 'unknown',
      },
    });
  } catch (error) {
    console.error('Random image error:', error);
    
    // Return error placeholder
    try {
      const { width: widthStr, height: heightStr } = await params;
      const width = Math.min(4000, Math.max(16, parseInt(widthStr) || 400));
      const height = Math.min(4000, Math.max(16, parseInt(heightStr) || 400));
      
      const errorPlaceholder = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 200, g: 50, b: 50, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      
      return new NextResponse(new Uint8Array(errorPlaceholder), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache',
        },
      });
    } catch {
      return new NextResponse('Error generating image', { status: 500 });
    }
  }
}
