import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';
import { publicImageFilter, ratingFilter } from '@/lib/contentFilters';
import { SqlParams, resolveTags, hasAllTagsSql, hasNoTagsSql, randomRows } from '@/lib/imageSearch';
import sharp from 'sharp';

const RANDOM_IMAGE_CACHE_CONTROL = 'public, max-age=60, s-maxage=120, stale-while-revalidate=300';

// GET /api/v1/random/[width]/[height]/image.png - Get random image resized to specified dimensions
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
    
    // Build dynamic query
    const sql = new SqlParams();
    const whereClauses: string[] = [publicImageFilter()];
    let noMatch = false;

    // Filter by tags (not all tags found → no match, so a placeholder is returned)
    if (tagNames.length > 0) {
      const { found, missing } = await resolveTags(tagNames);
      if (found.length === 0 || missing.length > 0) {
        noMatch = true;
      } else {
        whereClauses.push(...hasAllTagsSql('i', found, sql));
      }
    }

    // Exclude tags
    if (excludeTags.length > 0) {
      const { found } = await resolveTags(excludeTags);
      const clause = hasNoTagsSql('i', found, sql);
      if (clause) whereClauses.push(clause);
    }

    // Ratings filter
    const rFilter = ratingFilter(ratings, sql.next);
    if (rFilter) {
      whereClauses.push(`i.${rFilter.clause}`);
      sql.values.push(...rFilter.params);
    }

    // AI filters
    if (aiOnly) {
      whereClauses.push(`i.is_ai_generated = TRUE`);
    } else if (noAI) {
      whereClauses.push(`i.is_ai_generated = FALSE`);
    }

    // Calculate requested aspect ratio
    const requestedAspect = width / height;
    let images: any[] = [];

    if (matchSize && !noMatch) {
      // Find candidate images that match or exceed the requested dimensions and are close to aspect ratio
      const sizeParams = new SqlParams();
      sizeParams.values = [...sql.values];
      const matchSizeClauses = [
        ...whereClauses,
        `i.width >= ${sizeParams.add(Math.min(width, 400))}`,
        `i.height >= ${sizeParams.add(Math.min(height, 400))}`,
        `ABS((i.width::float / NULLIF(i.height, 0)::float) - ${sizeParams.add(requestedAspect)}) <= ${sizeParams.add(aspectTolerance)}`,
      ];
      images = await randomRows({
        select: 'i.id, i.sequential_id, i.url, i.width, i.height, i.rating',
        where: matchSizeClauses.join(' AND '),
        params: sizeParams.values,
        limit: 1,
      });
    }

    // Fallback to completely random image matching criteria
    if (images.length === 0 && !noMatch) {
      images = await randomRows({
        select: 'i.id, i.sequential_id, i.url, i.width, i.height, i.rating',
        where: whereClauses.join(' AND '),
        params: sql.values,
        limit: 1,
      });
    }

    if (images.length === 0) {
      // Return a gray placeholder image
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
    dbQuery(`UPDATE images SET views = views + 1 WHERE id = $1`, [image.id]).catch(err =>
      console.error('Error incrementing views:', err)
    );
    
    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': RANDOM_IMAGE_CACHE_CONTROL,
        'X-Image-Id': String(image.id),
        'X-DBID': String(image.id),
        'X-Post-Id': String(image.sequential_id),
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
