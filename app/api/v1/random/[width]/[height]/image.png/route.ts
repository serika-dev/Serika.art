import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import sharp from 'sharp';

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
    
    // Limit dimensions (max 4000x4000)
    const maxDim = 4000;
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
    const fit = searchParams.get('fit') || 'cover'; // cover, contain, fill, inside, outside
    const format = searchParams.get('format') || 'png'; // png, jpeg, webp
    const quality = Math.min(100, Math.max(1, parseInt(searchParams.get('quality') || '85')));
    const blur = searchParams.get('blur') === 'true';
    const grayscale = searchParams.get('grayscale') === 'true';
    
    const collection = await getCollection('images');
    const tagsCollection = await getCollection('tags');
    
    // Build query
    const query: any = {};
    
    // Default to safe-only unless specified
    const validRatings = ratings.filter((r) =>
      ['safe', 'questionable', 'explicit'].includes(r)
    );
    if (validRatings.length > 0) {
      query.rating = { $in: validRatings };
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
    
    // Get random image
    const images = await collection
      .aggregate([
        { $match: query },
        { $sample: { size: 1 } },
      ])
      .toArray();
    
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
          'Cache-Control': 'no-cache',
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
        'Cache-Control': 'public, max-age=60',
        'X-Image-Id': image._id.toString(),
        'X-Original-Width': String(image.width),
        'X-Original-Height': String(image.height),
        'X-Rating': image.rating,
      },
    });
  } catch (error: any) {
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
