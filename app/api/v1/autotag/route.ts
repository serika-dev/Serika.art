import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { validateApiKey, apiResponse, apiError } from '@/lib/apiAuth';
import { autotagImage, AutotaggerUnavailableError } from '@/lib/autotagger';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

// POST /api/v1/autotag - Predict tags and rating for an image
// Body: multipart `file`, or JSON { "post_id": 123 } for an existing post
export async function POST(request: NextRequest) {
  try {
    const validation = await validateApiKey(request, ['images:read']);
    if (!validation.valid) {
      return apiError(validation.error!, validation.statusCode!, 'UNAUTHORIZED');
    }

    let buffer: Buffer;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const file = (await request.formData()).get('file');
      if (!(file instanceof File)) return apiError('No file provided', 400, 'MISSING_FILE');
      if (file.size > MAX_FILE_SIZE) return apiError('File too large. Maximum size is 50MB', 400, 'FILE_TOO_LARGE');
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      // Tag an existing post. Only URLs from our own database are fetched –
      // arbitrary user URLs would let callers make the server request internal hosts.
      const { post_id } = await request.json().catch(() => ({}));
      const sequentialId = parseInt(String(post_id), 10);
      if (isNaN(sequentialId)) {
        return apiError('Provide a multipart "file" or a JSON body with "post_id"', 400, 'MISSING_FILE');
      }
      const img = await query(
        `SELECT url FROM images WHERE sequential_id = $1 AND deleted = FALSE AND unlisted = FALSE`,
        [sequentialId]
      );
      if (img.rows.length === 0) return apiError('Image not found', 404, 'NOT_FOUND');
      const res = await fetch(img.rows[0].url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return apiError('Could not download the image', 502, 'FETCH_FAILED');
      buffer = Buffer.from(await res.arrayBuffer());
    }

    const result = await autotagImage(buffer);
    return apiResponse(result);
  } catch (error) {
    if (error instanceof AutotaggerUnavailableError) {
      console.error('[v1 autotag]', error.message);
      return apiError('Autotagger is unavailable', 503, 'AUTOTAGGER_UNAVAILABLE');
    }
    console.error('API v1 autotag error:', error);
    return apiError('Could not process the image', 400, 'INVALID_IMAGE');
  }
}
