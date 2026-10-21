import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/db';
import { autotagImage, AutotaggerUnavailableError, isAutotaggerConfigured } from '@/lib/autotagger';
import { NO_STORE_HEADERS } from '@/lib/cacheHeaders';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const RATE_LIMIT_PER_MINUTE = 20;

// Per-IP limit so the tagger can't be used as a free GPU/CPU by scripts.
async function rateLimited(request: NextRequest): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown';
  const key = `rl:autotag:${ip}:${Math.floor(Date.now() / 60000)}`;
  try {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, 60);
    return count > RATE_LIMIT_PER_MINUTE;
  } catch {
    return false;
  }
}

// GET /api/autotag – lets the upload form know whether to show suggestions
export async function GET() {
  return NextResponse.json(
    { success: true, enabled: isAutotaggerConfigured() },
    { headers: { 'Cache-Control': 'public, max-age=60' } }
  );
}

// POST /api/autotag – multipart `file`; returns suggested tags and rating
export async function POST(request: NextRequest) {
  try {
    if (await rateLimited(request)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests, slow down a little', code: 'RATE_LIMITED' },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (max 25MB)' }, { status: 413, headers: NO_STORE_HEADERS });
    }

    const result = await autotagImage(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ success: true, ...result }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof AutotaggerUnavailableError) {
      console.error('[autotag]', error.message);
      return NextResponse.json(
        { success: false, error: 'Tag suggestions are unavailable right now', code: 'AUTOTAGGER_UNAVAILABLE' },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }
    console.error('Error suggesting tags:', error);
    return NextResponse.json({ success: false, error: 'Could not read that image' }, { status: 400, headers: NO_STORE_HEADERS });
  }
}
