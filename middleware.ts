import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { normalizeTagName } from '@/lib/tagName';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Redirect /user/Anonymous (or any case variation) to /user/anonymous
  if (pathname.toLowerCase() === '/user/anonymous' && pathname !== '/user/anonymous') {
    return NextResponse.redirect(new URL('/user/anonymous', request.url));
  }

  // Tags used to have spaces ("league of legends"); they are underscored now.
  // Old URLs are still linked and crawled, so send them to the one real page
  // permanently instead of serving duplicates.
  if (pathname === '/posts') {
    const tags = request.nextUrl.searchParams.get('tags');
    if (tags) {
      const fixed = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith('-') ? '-' + normalizeTagName(t.slice(1)) : normalizeTagName(t)))
        .join(',');
      if (fixed !== tags) {
        const url = request.nextUrl.clone();
        url.searchParams.set('tags', fixed);
        return NextResponse.redirect(url, 308);
      }
    }
  }

  if (pathname.startsWith('/artist/')) {
    let raw = '';
    try {
      raw = decodeURIComponent(pathname.slice('/artist/'.length));
    } catch {
      // malformed escape; let the page 404 it
    }
    const fixed = normalizeTagName(raw);
    if (raw && fixed !== raw) {
      const url = request.nextUrl.clone();
      url.pathname = `/artist/${encodeURIComponent(fixed)}`;
      return NextResponse.redirect(url, 308);
    }
  }

  // Allow anonymous uploads - no authentication required
  return NextResponse.next();
}

export const config = {
  matcher: ['/upload/:path*', '/user/:path*', '/posts', '/artist/:path*'],
};
