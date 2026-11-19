import sharp from 'sharp';

// Formats every browser can show. Anything else sharp can read (TIFF, HEIC,
// SVG, raw…) would end up as a post nobody can see.
const ALLOWED: Record<string, { contentType: string; ext: string }> = {
  jpeg: { contentType: 'image/jpeg', ext: 'jpg' },
  png: { contentType: 'image/png', ext: 'png' },
  gif: { contentType: 'image/gif', ext: 'gif' },
  webp: { contentType: 'image/webp', ext: 'webp' },
  avif: { contentType: 'image/avif', ext: 'avif' },
};

// sharp's default input limit; stops decompression bombs (tiny file, huge canvas)
const MAX_PIXELS = 268402689;

export const ALLOWED_IMAGE_TYPES = Object.values(ALLOWED).map((f) => f.contentType);

export class InvalidImageError extends Error {
  readonly code = 'INVALID_IMAGE';
}

export interface CheckedImage {
  format: string;
  contentType: string;
  ext: string;
  width: number;
  height: number;
}

/**
 * Decodes the whole image (every frame for animations) and throws
 * InvalidImageError if it is not a complete, displayable picture: unreadable,
 * truncated, corrupt, zero-sized or in a format browsers can't show.
 * Content type and extension come from the bytes, never from the client.
 */
export async function checkImage(buffer: Buffer): Promise<CheckedImage> {
  if (!buffer.length) throw new InvalidImageError('The file is empty.');

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new InvalidImageError('The file is not an image or is corrupt.');
  }

  // sharp reports AVIF as "heif" with AV1 compression
  const format = meta.format === 'heif' && meta.compression === 'av1' ? 'avif' : meta.format;
  const allowed = format ? ALLOWED[format] : undefined;
  if (!allowed) {
    throw new InvalidImageError(
      `Unsupported image format${format ? ` (${format})` : ''}. Allowed: JPEG, PNG, GIF, WebP, AVIF.`
    );
  }
  if (!meta.width || !meta.height) {
    throw new InvalidImageError('The image has no width or height.');
  }
  if (meta.width * meta.height * (meta.pages || 1) > MAX_PIXELS) {
    throw new InvalidImageError('The image is too large (too many pixels).');
  }

  // metadata() only reads the header; a cut-off or damaged file still passes
  // it. Decoding every pixel (failOn: 'error' includes truncation) catches those.
  try {
    await sharp(buffer, { failOn: 'error', animated: true, limitInputPixels: MAX_PIXELS }).stats();
  } catch {
    throw new InvalidImageError('The image is incomplete or corrupt (it could not be fully decoded).');
  }

  return {
    format,
    contentType: allowed.contentType,
    ext: allowed.ext,
    width: meta.width,
    height: meta.height,
  };
}

/** Thumbnail for a buffer that already passed checkImage. */
export function makeThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS })
    .resize(320, 320, { fit: 'cover' })
    .jpeg({ quality: 45, mozjpeg: true, progressive: true })
    .toBuffer();
}

/** Swap a filename's extension for the one matching its real format. */
export function withExt(filename: string, ext: string): string {
  const base = (filename || 'image').replace(/\.[^./\\]*$/, '');
  return `${base || 'image'}.${ext}`;
}
