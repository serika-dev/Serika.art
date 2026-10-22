import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { normalizeTagName } from '@/lib/tagName';

// Traffic breakdown (route × who), printed every 15 s: which requests are
// loading the server. Cheap: two counter bumps per request.
const stats = new Map<string, number>();
let statsTimer: ReturnType<typeof setInterval> | null = null;
function countRequest(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const ua = request.headers.get('user-agent') || '';
  const who = /googlebot|google-inspectiontool|storebot-google|googleother/i.test(ua)
    ? 'google'
    : /bingbot|yandex|baidu|petalbot|ahrefs|semrush|mj12|dotbot|bytespider|gptbot|claudebot|ccbot|amazonbot|facebookexternalhit|bot|crawl|spider|slurp/i.test(ua)
      ? 'otherbot'
      : 'human';
  const route = path.startsWith('/_next/image')
    ? '_next/image'
    : path.startsWith('/api/')
      ? `api/${path.split('/')[2] || ''}`
      : `/${path.split('/')[1] || ''}`;
  stats.set(`${route} ${who}`, (stats.get(`${route} ${who}`) || 0) + 1);
  if (!statsTimer) {
    statsTimer = setInterval(() => {
      if (stats.size === 0) return;
      const rows = [...stats.entries()].sort((a, b) => b[1] - a[1]);
      const total = rows.reduce((n, [, v]) => n + v, 0);
      console.log(`[traffic] ${total} req/15s | ${rows.slice(0, 14).map(([k, v]) => `${k}=${v}`).join(' ')}`);
      stats.clear();
    }, 15_000);
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  countRequest(request);

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
  // Everything except static build assets (the traffic counter needs to see
  // every route; the redirects above only act on their own paths).
  matcher: ['/((?!_next/static|favicon.ico).*)'],
};
