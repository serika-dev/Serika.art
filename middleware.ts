import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { normalizeTagName } from '@/lib/tagName';

// Datacenter ranges running a distributed scraper (Tencent Cloud, mostly
// Singapore): hundreds of rotating IPs with fake Chrome UAs fetching every
// post and its full-size image, ~50 req/s – enough to saturate the server.
// Blocked here with a tiny 403 before any render or DB work. Extra ranges can
// be added without a deploy through BLOCKED_CIDRS (comma-separated).
const BLOCKED_CIDRS = ['43.128.0.0/10', ...(process.env.BLOCKED_CIDRS || '').split(',').map((c) => c.trim()).filter(Boolean)];
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}
const BLOCKED = BLOCKED_CIDRS.map((cidr) => {
  const [base, bits] = cidr.split('/');
  const start = ipv4ToInt(base);
  const size = 2 ** (32 - Number(bits));
  return start === null || !Number.isFinite(size) ? null : { start: start - (start % size), end: start - (start % size) + size };
}).filter(Boolean) as { start: number; end: number }[];
function isBlocked(ip: string | null): boolean {
  const n = ip ? ipv4ToInt(ip) : null;
  return n !== null && BLOCKED.some((r) => n >= r.start && n < r.end);
}
let blockedCount = 0;

// Traffic breakdown (route × who), printed every 15 s: which requests are
// loading the server. Cheap: two counter bumps per request.
const stats = new Map<string, number>();
const sources = new Map<string, number>(); // "ip ua" for page requests
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
  if (route === '/image' || route === '/posts' || route === '/artist') {
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || '?';
    const key = `${ip} ${request.headers.get('cf-ipcountry') || ''} ${ua.slice(0, 90)}`;
    sources.set(key, (sources.get(key) || 0) + 1);
  }
  if (!statsTimer) {
    statsTimer = setInterval(() => {
      if (stats.size === 0) return;
      const rows = [...stats.entries()].sort((a, b) => b[1] - a[1]);
      const total = rows.reduce((n, [, v]) => n + v, 0);
      console.log(`[traffic] ${total} req/15s | ${rows.slice(0, 14).map(([k, v]) => `${k}=${v}`).join(' ')}`);
      const top = [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (top.length) console.log(`[traffic-src] ${top.map(([k, v]) => `${v}x ${k}`).join(' || ')}`);
      if (blockedCount) console.log(`[traffic-blocked] ${blockedCount} req/15s from blocked ranges`);
      blockedCount = 0;
      stats.clear();
      sources.clear();
    }, 15_000);
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  if (isBlocked(clientIp)) {
    blockedCount++;
    return new NextResponse('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
  }
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
