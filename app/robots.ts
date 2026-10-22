import { MetadataRoute } from 'next';

// One group for every crawler: a separate "Googlebot" group would make Google
// ignore everything under "*". /_next/static (JS/CSS) and /_next/image (the
// post images themselves) must stay crawlable for rendering and Google Images.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/_next/static/', '/_next/image', '/api/v1/random/'],
        disallow: [
          '/api/',
          '/admin',
          '/settings',
          '/api-keys',
          '/login',
          '/upload',
          '/favorites',
          // Endless re-sorts and filters of the same listings (pages are noindex anyway)
          '/posts?*sort=',
          '/posts?*uploader=',
          '/*?*_rsc=',
        ],
      },
    ],
    sitemap: 'https://serika.art/sitemap.xml',
    host: 'https://serika.art',
  };
}
