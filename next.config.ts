import type { NextConfig } from "next";
import { hostname } from "os";

const nextConfig: NextConfig = {
  images: {
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
