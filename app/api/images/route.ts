import { NextRequest, NextResponse } from 'next/server';
import { listImages, parseImageListParams } from '@/lib/imageSearch';
import { publicCacheHeaders, NO_STORE_HEADERS } from '@/lib/cacheHeaders';

export async function GET(request: NextRequest) {
  try {
    const params = parseImageListParams(request.nextUrl.searchParams);
    const result = await listImages(params);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: result.status, headers: publicCacheHeaders(30) }
      );
    }

    // Response is fully keyed by URL params (no cookies), so the CDN may share
    // it. Random sort must never be cached or every visitor sees the same page.
    return NextResponse.json(result, {
      headers: params.sort === 'random' ? NO_STORE_HEADERS : publicCacheHeaders(30, { swr: 300 }),
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}
