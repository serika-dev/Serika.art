// Upload image validation (no database, no storage).
// Run: bun --no-env-file test tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { checkImage, InvalidImageError, withExt } from '../lib/imageValidation';

const solid = (format: 'jpeg' | 'png' | 'webp' | 'gif') =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 40, b: 90 } } })
    .toFormat(format)
    .toBuffer();

// Noise compresses badly, so cutting the file off loses real pixel data
async function noisyJpeg() {
  const px = Buffer.alloc(256 * 256 * 3);
  for (let i = 0; i < px.length; i++) px[i] = (i * 7919) % 251;
  return sharp(px, { raw: { width: 256, height: 256, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}

for (const format of ['jpeg', 'png', 'webp', 'gif'] as const) {
  test(`checkImage accepts a valid ${format}`, async () => {
    const r = await checkImage(await solid(format));
    assert.equal(r.width, 64);
    assert.equal(r.height, 48);
    assert.equal(r.contentType, `image/${format}`);
  });
}

test('checkImage rejects a truncated jpeg', async () => {
  const full = await noisyJpeg();
  await assert.rejects(checkImage(full.subarray(0, Math.floor(full.length * 0.6))), InvalidImageError);
});

test('checkImage rejects an empty file', async () => {
  await assert.rejects(checkImage(Buffer.alloc(0)), InvalidImageError);
});

test('checkImage rejects non-image bytes', async () => {
  await assert.rejects(checkImage(Buffer.from('definitely not an image')), InvalidImageError);
});

test('checkImage rejects SVG even though sharp can read it', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
  await assert.rejects(checkImage(svg), /Unsupported image format/);
});

test('content type comes from the bytes, not the file name', async () => {
  const r = await checkImage(await solid('png'));
  assert.equal(withExt('photo.jpg', r.ext), 'photo.png');
});
