import type { NextConfig } from "next";
import { hostname } from "os";
import path from "path";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(',').map(s => s.trim())
  : [];

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 && { allowedDevOrigins }),
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      // Browser bundles get a ~2 KB fetch-based axios (see lib/axiosLite.ts);
      // server code keeps the real one.
      axios: { browser: './lib/axiosLite.ts' },
    },
  },
  compress: true,
  // ISR pages (/, /image/:id) are cached by Cloudflare too; cap how long the
  // edge may serve them stale so a deploy is picked up within the hour.
  expireTime: 3600,
  poweredByHeader: false,
  experimental: {
    // The optimizer resizes multi-MB originals (a 9 MB post takes ~8 s of
    // CPU). Unbounded, a crawl burst starves the Node event loop and the site
    // stops answering; two at a time leaves the rest of the app responsive.
    imgOptConcurrency: 2,
    // Import only the components actually used from these barrel packages,
    // instead of their whole index (smaller client bundles).
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-avatar',
      '@radix-ui/react-toggle-group',
    ],
  },
  reactStrictMode: true,
  async headers() {
    return [
      // Apply hardened security headers site-wide
      { source: '/:path*', headers: securityHeaders },
      // Long-lived immutable caching for Next static assets
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  images: {
    // Thumbnails are pre-generated & CDN-cached. WebP only: the optimizer now
    // resizes full-size posts on the image page, and AVIF encodes several times
    // slower – that would show up as first-view latency.
    formats: ['image/webp'],
    qualities: [75],
    minimumCacheTTL: 31536000,
    // Tuned to the grid layout breakpoints: 50vw mobile, 33vw tablet, 25vw desktop, 20vw 2xl
    deviceSizes: [640, 750, 828, 1080, 1200, 1536, 1920],
    imageSizes: [128, 256, 320, 400],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'inline' as const,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: 'r2.serika.dev',
      },
      {
        protocol: 'https',
        hostname: 'cdn.serika.art',
      },
      {
        protocol: 'https',
        hostname: 'serika.art',
      },
      {
        protocol: 'https',
        hostname: 'r2.serika.art',
      },
      {
        protocol: 'https',
        hostname: 'accounts.serika.dev',
      },
      {
        protocol: 'https',
        hostname: 'api.serika.dev',
      },
      {
        protocol: 'https',
        hostname: 'beta-api.serika.dev',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      // Serika Ads creatives
      {
        protocol: 'https',
        hostname: 'serika-ads.s3.eu-central-003.backblazeb2.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.serika.dev',
      },
    ],
  },
};

export default nextConfig;
