// Cache-Control helpers for responses that are safe to share between visitors.
//
// Cloudflare only stores HTML/JSON when a Cache Rule marks the request
// "eligible for cache" (see scripts/cloudflare-optimize.ts). With the rule's
// edge TTL set to "use cache-control header if present, bypass if not", these
// headers decide what the edge keeps and for how long:
//   - Cache-Control       → browsers (short) and any shared cache (s-maxage)
//   - CDN-Cache-Control   → CDNs only (Cloudflare honours it over Cache-Control)
// Never use these on a response that depends on the visitor's cookies.

export function publicCacheHeaders(
  edgeSeconds: number,
  { swr = edgeSeconds * 4, browserSeconds = 0 }: { swr?: number; browserSeconds?: number } = {}
): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=${browserSeconds}, s-maxage=${edgeSeconds}, stale-while-revalidate=${swr}`,
    'CDN-Cache-Control': `public, max-age=${edgeSeconds}, stale-while-revalidate=${swr}`,
  };
}

export const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store',
};
