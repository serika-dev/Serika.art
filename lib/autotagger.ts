import sharp from 'sharp';
import { query } from '@/lib/db';

// Client for an autotagger service speaking the Danbooru autotagger API
// (https://github.com/danbooru/autotagger):
//   POST {AUTOTAGGER_URL}/evaluate   multipart: file, threshold, limit, format=json
//   → [{ "filename": "...", "tags": { "1girl": 0.99, "rating:s": 0.8, ... } }]
// Works with the stock ghcr.io/danbooru/autotagger image or the bundled
// WD-tagger service in autotagger/ (which also returns tag categories).

const AUTOTAGGER_URL = (process.env.AUTOTAGGER_URL || '').replace(/\/+$/, '');
const AUTOTAGGER_API_KEY = process.env.AUTOTAGGER_API_KEY || '';
const TIMEOUT_MS = parseInt(process.env.AUTOTAGGER_TIMEOUT_MS || '20000', 10);

// Scores at or above these are "recommended" (pre-selected in the UI, applied
// by auto_tag uploads). Characters need more confidence – a wrong character
// tag is worse than a missing one.
const GENERAL_THRESHOLD = parseFloat(process.env.AUTOTAGGER_GENERAL_THRESHOLD || '0.35');
const CHARACTER_THRESHOLD = parseFloat(process.env.AUTOTAGGER_CHARACTER_THRESHOLD || '0.75');
// Everything above this is returned as a lower-confidence suggestion.
const MIN_SCORE = 0.2;

export type TagType = 'general' | 'artist' | 'character' | 'copyright' | 'meta';
export type Rating = 'safe' | 'questionable' | 'explicit';

export interface SuggestedTag {
  name: string;
  type: TagType;
  score: number;
  recommended: boolean;
  /** Tag does not exist on Serika yet (it would be created on upload). */
  isNew: boolean;
}

export interface AutotagResult {
  tags: SuggestedTag[];
  rating: { value: Rating; score: number } | null;
}

export class AutotaggerUnavailableError extends Error {}

export function isAutotaggerConfigured(): boolean {
  return AUTOTAGGER_URL.length > 0;
}

interface EvaluateResponse {
  filename?: string;
  tags: Record<string, number>;
  categories?: Record<string, string>;
}

/** Tag an image buffer. Throws AutotaggerUnavailableError if the service is not set up or unreachable. */
export async function autotagImage(input: Buffer): Promise<AutotagResult> {
  if (!isAutotaggerConfigured()) {
    throw new AutotaggerUnavailableError('Autotagger is not configured (set AUTOTAGGER_URL)');
  }

  // Taggers work at 224–448px; sending a small JPEG keeps the request tiny.
  // flatten() puts transparent PNGs on white, which is what the models expect.
  // Some files libvips can't decode (e.g. "source: bad seek") – the tagger
  // service decodes with Pillow, so send those as they are.
  let small: Buffer;
  let filename = 'image.jpg';
  let type = 'image/jpeg';
  try {
    small = await sharp(input, { animated: false, failOn: 'none' })
      .rotate()
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (err: any) {
    console.warn('[autotagger] sharp could not decode the image, sending the original:', err?.message || err);
    small = input;
    filename = 'image';
    type = 'application/octet-stream';
  }

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(small)], { type }), filename);
  form.append('threshold', String(MIN_SCORE));
  form.append('limit', '100');
  form.append('format', 'json');

  let raw: EvaluateResponse;
  try {
    const res = await fetch(`${AUTOTAGGER_URL}/evaluate`, {
      method: 'POST',
      body: form,
      headers: AUTOTAGGER_API_KEY ? { Authorization: `Bearer ${AUTOTAGGER_API_KEY}` } : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    raw = Array.isArray(json) ? json[0] : json;
    if (!raw || typeof raw.tags !== 'object') throw new Error('Unexpected response');
  } catch (err: any) {
    throw new AutotaggerUnavailableError(`Autotagger request failed: ${err?.message || err}`);
  }

  return mapPredictions(raw);
}

const RATING_KEYS: Record<string, Rating> = {
  'rating:g': 'safe',
  'rating:general': 'safe',
  'rating:s': 'safe',
  'rating:sensitive': 'safe',
  'rating:q': 'questionable',
  'rating:questionable': 'questionable',
  'rating:e': 'explicit',
  'rating:explicit': 'explicit',
};

async function mapPredictions(raw: EvaluateResponse): Promise<AutotagResult> {
  const ratingScores: Record<Rating, number> = { safe: 0, questionable: 0, explicit: 0 };
  const predictions: { name: string; score: number; category?: string }[] = [];

  for (const [name, score] of Object.entries(raw.tags)) {
    const rating = RATING_KEYS[name];
    if (rating) {
      ratingScores[rating] += score;
    } else if (!name.startsWith('rating:')) {
      predictions.push({ name, score, category: raw.categories?.[name] });
    }
  }

  // Serika has both "long hair" and "long_hair" style tags – reuse whichever
  // spelling already has more posts, otherwise keep Danbooru's underscores.
  const variants = predictions.flatMap((p) => [p.name, p.name.replace(/_/g, ' ')]);
  const existing = variants.length
    ? await query<{ name: string; type: TagType; count: number }>(
        `SELECT name, type, count FROM tags WHERE name = ANY($1::text[])`,
        [Array.from(new Set(variants))]
      )
    : { rows: [] };
  const byName = new Map(existing.rows.map((r) => [r.name, r]));

  const seen = new Set<string>();
  const tags: SuggestedTag[] = [];
  for (const p of predictions.sort((a, b) => b.score - a.score)) {
    const match = [byName.get(p.name), byName.get(p.name.replace(/_/g, ' '))]
      .filter(Boolean)
      .sort((a, b) => b!.count - a!.count)[0];
    const name = match?.name ?? p.name;
    if (seen.has(name)) continue;
    seen.add(name);

    const type: TagType = match?.type ?? (p.category === 'character' ? 'character' : 'general');
    const threshold = type === 'character' ? CHARACTER_THRESHOLD : GENERAL_THRESHOLD;
    tags.push({
      name,
      type,
      score: Math.round(p.score * 1000) / 1000,
      recommended: p.score >= threshold,
      isNew: !match,
    });
  }

  const best = (Object.entries(ratingScores) as [Rating, number][]).sort((a, b) => b[1] - a[1])[0];
  return {
    tags,
    rating: best && best[1] > 0 ? { value: best[0], score: Math.round(Math.min(best[1], 1) * 1000) / 1000 } : null,
  };
}
