import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/settings/',
          '/api-keys/',
          '/login/',
          '/upload/',
          '/favorites/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
      {
        userAgent: 'Googlebot-Image',
        allow: ['/image/', '/posts'],
      },
    ],
    sitemap: 'https://serika.art/sitemap.xml',
    host: 'https://serika.art',
  };
}
