import { NextRequest, NextResponse } from 'next/server';

// GET /api/v1 - API index/info
export async function GET(request: NextRequest) {
  return NextResponse.json({
    name: 'SerikaART API',
    version: '1.0.0',
    description: 'Public API for Serika image platform',
    documentation: 'https://serika.art/api-docs',
    endpoints: {
      images: {
        list: 'GET /api/v1/images',
        get: 'GET /api/v1/images/:id',
        delete: 'DELETE /api/v1/images/:id',
      },
      random: {
        metadata: 'GET /api/v1/random',
        image: 'GET /api/v1/random/:width/:height/image.png',
      },
      tags: {
        list: 'GET /api/v1/tags',
        get: 'GET /api/v1/tags/:name',
      },
      users: {
        get: 'GET /api/v1/users/:id_or_username',
      },
      search: {
        query: 'GET /api/v1/search',
      },
      upload: {
        create: 'POST /api/v1/upload',
      },
      stats: {
        get: 'GET /api/v1/stats',
      },
    },
    authentication: {
      methods: ['Authorization: Bearer <api_key>', 'X-API-Key: <api_key>'],
      key_format: 'sk_serika_*',
      manage_keys: 'https://serika.art/api-keys',
    },
    rate_limits: {
      user: '60 requests/minute',
      premium: '120 requests/minute',
      moderator: '120 requests/minute',
      admin: '1000 requests/minute',
    },
  });
}
