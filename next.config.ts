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
  },
  compress: true,
  poweredByHeader: false,
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
    // Thumbnails are pre-generated & CDN-cached; keep modern formats + sane device sizes
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
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
    ],
  },
};

export default nextConfig;
